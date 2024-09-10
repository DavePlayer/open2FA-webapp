import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";

import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { App } from "./App";

import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Login } from "./pages/login";
import { UserData } from "./pages/UserData";
import { Register } from "./pages/Register";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/userdata" element={<UserData />} />
        <Route
          path="*"
          element={
            <div className="w-full h-[100vh] flex justify-center items-center">
              <h1 className="text-6xl text-center">
                404 This page does not exist
              </h1>
            </div>
          }
        />
      </Routes>
    </BrowserRouter>
    <ToastContainer />
  </StrictMode>
);
