// src/index.js
import express, { Express, Request, Response } from "express";
import dotenv from "dotenv";
import { Sequelize } from "sequelize";
import { initializeUserModel } from "./Models/User";
import bcrypt from "bcrypt";
import cors from "cors";
import jwt from "jsonwebtoken";

const DB = new Sequelize("sqlite::memory:");
const User = initializeUserModel(DB);

dotenv.config();

const app: Express = express();
const port = process.env.PORT || 3000;
app.use(express.json());
app.use(cors());
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

  if (!login || !password) {
    console.log(req.body);
    res.statusMessage = "invalid body structure";
    return res.status(403).end();
  }

  try {
    const foundUser = await User.findOne({
      where: {
        email: login,
      },
    });

    if (!foundUser) {
      res.statusMessage = "User Not Found";
      return res.status(404).end();
    }

    const isMatch = await bcrypt.compare(password, foundUser.password);

    if (isMatch) {
      if (!process.env.JWT_SECRET) {
        console.error("JWT_SECRET enviromental variable is undefined");
        res.statusMessage = "JWT secret is undefined";
        return res.status(500).end();
      }

      const user = {
        id: foundUser.id,
        email: foundUser.email,
      };
      const token = jwt.sign(user, process.env.JWT_SECRET as string);
      return res.json({
        ...user,
        token,
      });
    } else {
      console.log(password, foundUser.password);
      res.statusMessage = "Passwords do not match";
      return res.status(403).end();
    }
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
        email: login,
      },
    });

    if (!foundUser) {
      const createdUser = await User.create({
        email: login,
        password: bcrypt.hashSync(
          password,
          bcrypt.genSaltSync(parseInt(process.env.SALT as string))
        ),
        isTwoFAon: false,
      });

      return res.json({
        id: createdUser.id,
        email: createdUser.email,
        isTwoFAon: createdUser.isTwoFAon,
      });
    }

    res.statusMessage = "user already exist";
    return res.status(408).end();
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
