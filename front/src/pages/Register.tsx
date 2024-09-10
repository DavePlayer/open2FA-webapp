import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";

export const Register = () => {
  const [loginData, setLoginData] = useState({ email: "", password: "" });
  const [emailError, setEmailError] = useState("");
  const [passError, setPasssError] = useState("");
  const navigate = useNavigate();

  const handleForm = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLoginData((prev) => {
      return {
        ...prev,
        [e.target.name]: e.target.value.replace(/\s/g, ""),
      };
    });
  };

  const handleEmailSyntax = () => {
    const regex =
      /(?:[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*|"(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21\x23-\x5b\x5d-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])*")@(?:(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?|\[(?:(?:(2(5[0-5]|[0-4][0-9])|1[0-9][0-9]|[1-9]?[0-9]))\.){3}(?:(2(5[0-5]|[0-4][0-9])|1[0-9][0-9]|[1-9]?[0-9])|[a-z0-9-]*[a-z0-9]:(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21-\x5a\x53-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])+)\])/;
    if (!regex.test(loginData.email)) {
      setEmailError("invalid email format");
    } else {
      setEmailError("");
    }

    return regex.test(loginData.email);
  };
  const handlePassword = () => {
    const { password } = loginData;
    if (password.length === 0) {
      setPasssError("password too short");
      return false;
    }
    setPasssError("");
    return true;
  };

  const handleSubmit = (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
    e.preventDefault();
    if (handlePassword() && handleEmailSyntax()) {
      fetch(`http://127.0.0.1:3000/register`, {
        method: "POST",
        body: JSON.stringify({
          login: loginData.email,
          password: loginData.password,
        }),
        headers: {
          "Content-Type": "application/json", // This line is important
        },
      })
        .then((data) => {
          if (data.ok) {
            console.log(data);
            return navigate(`/login`);
          } else throw data;
        })
        .catch((err) => {
          console.error(err);
          toast.error(err.statusText);
        });
    }
  };

  return (
    <main className="flex h-[100vh] bg-mainBg">
      <section className="w-1/2 m-auto flex justify-center items-center text-default-color">
        <article className="flex flex-col 2xl:w-1/2 w-3/4 ">
          <form action="#" className="w-full">
            <p className="mt-10 mb-5 text-xl text-center">
              Register new Account
            </p>
            <p className="w-full mb-1 pl-4 text-error text-sm">{emailError}</p>
            <input
              className="w-full mb-4"
              type="email"
              name="email"
              placeholder="E-mail"
              value={loginData.email}
              onChange={(e) => handleForm(e)}
              onBlur={() => handleEmailSyntax()}
            />
            <p className="w-full mb-1 pl-4 text-error text-sm">{passError}</p>
            <input
              className="w-full"
              type="password"
              name="password"
              placeholder="Password"
              value={loginData.password}
              onChange={(e) => handleForm(e)}
              onBlur={() => handlePassword()}
            />
            <button
              onClick={(e) => handleSubmit(e)}
              className="w-full gradient-button"
            >
              Register
            </button>
          </form>
        </article>
      </section>
    </main>
  );
};
