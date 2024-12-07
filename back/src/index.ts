// src/index.js
import express, { Express, Request, Response } from "express";
import dotenv from "dotenv";
import { Sequelize } from "sequelize";
import { initializeUserModel } from "./Models/User";
import bcrypt from "bcrypt";
import cors from "cors";
import jwt from "jsonwebtoken";

import { authenticator } from "otplib";
import qrcode from "qrcode";
import { validateJWT } from "./middleware/validateJWT";

const DB = new Sequelize({
  dialect: "sqlite",
  storage: "/tmp/database.sqlite", // Specifies the file path for the SQLite database
});
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
  const { login, password, code } = req.body;

  if (!login || !password) {
    console.log(req.body);
    res.statusMessage = "invalid body structure";
    return res.status(403).json({
      codeRequired: false,
      message: "invalid body structure",
    });
  }

  try {
    const foundUser = await User.findOne({
      where: {
        email: login,
      },
    });

    if (!foundUser) {
      res.statusMessage = "User Not Found";
      return res.status(404).json({
        codeRequired: false,
        message: "User not found",
      });
    }

    console.log(foundUser);

    const isMatch = await bcrypt.compare(password, foundUser.password);

    if (isMatch) {
      if (!process.env.JWT_SECRET) {
        console.error("JWT_SECRET enviromental variable is undefined");
        res.statusMessage = "JWT secret env on server is undefined";
        return res.status(500).json({
          codeRequired: false,
          message: "JWT secret is undefined",
        });
      }

      if (foundUser.isTwoFAon) {
        if (!code) {
          res.statusMessage = "no 2FA code provided";
          return res.status(401).json({
            codeRequired: true,
            issuer: process.env.ISSUER || "",
            // this library behaves weirdly for adding this without my info, but ok
            label: `${process.env.ISSUER || ""}:${foundUser.email}`,
          });
        }

        const verified = authenticator.check(code, foundUser.twoFaHash || "");

        if (!verified) {
          res.statusMessage = "invalid 2FA Code";
          return res.status(404).json({
            codeRequired: true,
            message: "invalid 2FA code",
          });
        }
      }

      const user = {
        id: foundUser.id,
        email: foundUser.email,
        is2FAon: foundUser.isTwoFAon,
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
    res.status(500).json({ error: "Internal server error", details: err });
  }
});

app.post("/getTwoFAQrCode", validateJWT, async (req, res) => {
  const { token } = req.body;
  const userData = token;

  const user = await User.findOne({
    where: {
      id: token.id,
    },
  });

  if (!user) {
    res.statusMessage = "sth went wrong. user for qrimage does not exist";
    return res.status(500).end();
  }

  const secret = authenticator.generateSecret();
  const uri = authenticator.keyuri(
    userData.email,
    process.env.ISSUER || "",
    secret
  );

  const image = await qrcode.toDataURL(uri);

  await user.update({ isTwoFAon: true, tempTwoFaHash: secret });
  await user.save();

  console.log(image, uri);
  res.json({
    image,
  });
});

app.post("/registerTwoFA", validateJWT, async (req, res) => {
  if (!req.body) {
    return res.status(400).send("Request body is missing");
  }
  const { code, token } = req.body;

  const user = await User.findOne({
    where: {
      id: token.id,
    },
  });

  if (!code) {
    console.log(req.body);
    res.statusMessage = "invalid body structure";
    return res.status(403).end();
  }

  if (!user) {
    res.statusMessage = "sth went wrong. user for code a user does not exist";
    return res.status(500).end();
  }

  if (user.isTwoFAon == false || user.tempTwoFaHash == null) {
    res.statusMessage =
      "User is not ready to have 2fa ON. no qr image for an app was created prior";
    return res.status(404).end();
  }

  const expectedCode = authenticator.generate(user.tempTwoFaHash);
  console.log("Expected Code:", expectedCode);

  const verified = authenticator.check(code, user.tempTwoFaHash);
  console.log("Verification Result:", verified);

  if (!verified) {
    res.statusMessage = "code does not match the user secret";
    return res.status(403).end();
  }

  await user.update({
    isTwoFAon: true,
    twoFaHash: user.tempTwoFaHash,
    tempTwoFaHash: null,
  });
  await user.save();

  res.send("ok");
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
