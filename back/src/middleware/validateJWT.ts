import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export const validateJWT = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const auth = req.headers["authorization"];
  if (!auth) {
    res.statusMessage = "no token included inside http header";
    return res
      .status(403)
      .json({ status: "no token included inside http header" });
  }
  if (!process.env.JWT_SECRET) {
    res.statusMessage = "JWT_SECRET enviromental variable is undefined";
    console.error("JWT_SECRET enviromental variable is undefined");
    return res.status(500).json({ status: "internal server errror" });
  }
  try {
    const token = jwt.verify(auth, process.env.JWT_SECRET);
    req.body.token = token;
    next();
  } catch (err) {
    res.statusMessage = "invalid token";
    return res.status(403).json("invalid token");
  }
};
