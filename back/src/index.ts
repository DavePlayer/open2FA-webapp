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
    return res.status(400).send("Brak obiektu Body w zapytaniu");
  }
  const { login, password, code } = req.body;

  if (!login || !password) {
    console.log(req.body);
    res.statusMessage = "Niepoprawna konstrukcja obiektu Body";
    return res.status(403).json({
      codeRequired: false,
      message: "Niepoprawna konstrukcja obiektu Body",
    });
  }

  try {
    const foundUser = await User.findOne({
      where: {
        email: login,
      },
    });

    if (!foundUser) {
      res.statusMessage = "User not found";
      return res.status(404).json({
        codeRequired: false,
        message: "Nie znaleziono użytkownika",
      });
    }

    console.log(foundUser);

    const isMatch = await bcrypt.compare(password, foundUser.password);

    if (isMatch) {
      if (!process.env.JWT_SECRET) {
        console.error("Nie ustawiono sekretu JWT_SECRET na serwerze");
        res.statusMessage = "Sekret JWT niezdefinowany na serwerze";
        return res.status(500).json({
          codeRequired: false,
          message: "Sekret JWT niezdefiniowany",
        });
      }

      if (foundUser.isTwoFAon) {
        if (code == undefined || code == null) {
          res.statusMessage = "Nie podano kodu 2FA";
          return res.status(401).json({
            codeRequired: true,
            issuer: process.env.ISSUER || "",
            // this library behaves weirdly for adding this without my info, but ok
            label: `${process.env.ISSUER || ""}:${foundUser.email}`,
          });
        }

        if (!code) {
          return res.status(401).json({
            message: "Kod 2FA nie może być pusty",
          });
        }

        const verified = authenticator.check(code, foundUser.twoFaHash || "");

        if (!verified) {
          res.statusMessage = "Niepoprawny kod 2FA";
          return res.status(404).json({
            message: "Niepoprawny kod 2FA",
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
      res.statusMessage = "Hasła się nie zgadzają";
      return res.status(403).end();
    }
  } catch (err) {
    console.error("Error during user lookup:", err);
    res.status(500).json({ error: "Wewnętrzny błąd serwera", details: err });
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
    res.statusMessage =
      "Użytkownik dla kody QR nie istnieje. Coś poszło nie tak";
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
    return res.status(400).send("Brak obiektu Body");
  }
  const { code, token } = req.body;

  const user = await User.findOne({
    where: {
      id: token.id,
    },
  });

  if (!code) {
    console.log(req.body);
    res.statusMessage = "Niepoprawna budowa obiektu Body";
    return res.status(403).end();
  }

  if (!user) {
    res.statusMessage =
      "Użytkownik dla kody QR nie istnieje. Coś poszło nie tak";
    return res.status(500).end();
  }

  if (user.isTwoFAon == false || user.tempTwoFaHash == null) {
    res.statusMessage =
      "Użytkownik nie jest gotowy by włączyć 2FA. Nie wygenerowano wcześniej żadnego kodu";
    return res.status(404).end();
  }

  const expectedCode = authenticator.generate(user.tempTwoFaHash);
  console.log("Expected Code:", expectedCode);

  const verified = authenticator.check(code, user.tempTwoFaHash);
  console.log("Verification Result:", verified);

  if (!verified) {
    res.statusMessage = "Kod nie zgadza się z sekretem";
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
    return res.status(400).send("Brak obiektu Body w zapytaniu");
  }
  const { login, password } = req.body;

  if (!login || !password)
    return res.status(403).send("Niepoprawna budowa obiektu Body");
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

    res.statusMessage = "Użytkownik już istnieje";
    return res.status(408).end();
  } catch (err) {
    console.error("Error during user lookup:", err);
    res.status(500).send({ error: "Wewnętrzny błąd serwera", details: err });
  }
});

DB.sync().then((req) => {
  app.listen(port, () => {
    console.log(`[server]: Server is running at http://localhost:${port}`);
  });
});
