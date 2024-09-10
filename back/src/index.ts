// src/index.js
import express, { Express, Request, Response } from "express";
import dotenv from "dotenv";
import { Sequelize } from "sequelize";
import { initializeUserModel } from "./Models/User";
import bcrypt from "bcrypt";

const DB = new Sequelize("sqlite::memory:");
const User = initializeUserModel(DB);

dotenv.config();

const app: Express = express();
const port = process.env.PORT || 3000;
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/", (req: Request, res: Response) => {
  User.findAll()
    .then((users) => {
      res.send(users);
    })
    .catch((err) => {
      res.status(505).send(err);
    });
});

app.post("/login", async (req: Request, res: Response) => {
  if (!req.body) {
    return res.status(400).send("Request body is missing");
  }
  const { login, password } = req.body;

  if (!login || !password)
    return res.status(403).send("invalid body structure");

  try {
    const foundUser = await User.findOne({
      where: {
        name: login,
      },
    });

    if (!foundUser) {
      return res.status(404).send("User not found");
    }

    const isMatch = await bcrypt.compare(password, foundUser.password || "");

    return res.json({
      id: foundUser.id,
      name: foundUser.name,
      isTwoFAon: foundUser.isTwoFAon,
    });
  } catch (err) {
    console.error("Error during user lookup:", err);
    res.status(500).send({ error: "Internal server error", details: err });
  }
});

app.post("/register", async (req: Request, res: Response) => {
  if (!req.body) {
    return res.status(400).send("Request body is missing");
  }
  const { login, password } = req.body;

  if (!login || !password)
    return res.status(403).send("invalid body structure");
  try {
    const foundUser = await User.findOne({
      where: {
        name: login,
      },
    });

    if (!foundUser) {
      const createdUser = await User.create({
        name: login,
        password: password,
        isTwoFAon: false,
      });

      return res.json({
        id: createdUser.id,
        name: createdUser.name,
        isTwoFAon: createdUser.isTwoFAon,
      });
    }

    return res.status(408).send("user already registered");
  } catch (err) {
    console.error("Error during user lookup:", err);
    res.status(500).send({ error: "Internal server error", details: err });
  }
});

DB.sync().then((req) => {
  app.listen(port, () => {
    console.log(`[server]: Server is running at http://localhost:${port}`);
  });
});
