import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { socket } from "../socket";
import QRCode from "react-qr-code";
import forge from "node-forge";
import { debounce } from "lodash";

export interface QrCodeData {
  relayUrl: string;
  publicKey: string;
  websocketId: string;
  issuer: string;
  label: string;
}

export const Login = () => {
  const [loginData, setLoginData] = useState({ email: "", password: "" });
  const [emailError, setEmailError] = useState("");
  const [passError, setPasssError] = useState("");
  const [twoFACode, setTwoFACode] = useState("");
  const [twoFArequired, setTwoFArequired] = useState(false);
  const [isTwoFACodeSet, setIsTwoFACodeSet] = useState(false);
  const navigate = useNavigate();
  const [isConnected, setIsConnected] = useState(socket.connected);
  const privateKeyRef = useRef<null | string>(null);
  const [decryptionInProgress, setDecryptionInProgress] = useState(false);
  const [qrData, setQrData] = useState<QrCodeData>({
    publicKey: "",
    relayUrl: "http://10.0.0.189:9999/sendCode", // TODO make relay listen on ipv4 or on every network card
    websocketId: "",
    issuer: "",
    label: "",
  });

  // Debounced function that wraps the decryption logic
  const handleSendCodeDebounced = useRef(
    debounce(async (message) => {
      if (decryptionInProgress) return;

      setDecryptionInProgress(true);
      toast.info("Otrzymano kod 2FA. Deszyfrowanie");
      const digits = message;
      if (digits) {
        try {
          if (privateKeyRef.current) {
            const decryptedData = await decryptData(
              message,
              privateKeyRef.current
            );
            setTwoFACode(decryptedData);
            setIsTwoFACodeSet(true);
          } else {
            toast.error(
              "Klucz prywatny usunięty zanim odszyfrowano kod. To nie powinno było się wydarzyć"
            );
            console.error("Private key is not available.");
          }
        } catch (err) {
          toast.error("Nie udało się odszyfrować wiadomości. Sprubuj ponownie");
          console.error("Failed to decrypt the code:", err);
        } finally {
          setDecryptionInProgress(false);
        }
      }
    }, 2000) // Debounce delay set to 500ms
  ).current;

  // generatign these keys takes a lot of time
  // not suprised to be honest
  const startKeyGenerationInWorker = () => {
    const worker = new Worker(new URL("./../rsaWorker.ts", import.meta.url), {
      type: "module", // Explicitly set worker type as a module
    });

    worker.onmessage = (e) => {
      const { keys } = e.data;
      console.log("Received RSA keys from worker:", keys);
      privateKeyRef.current = keys.privateKeyPem;

      setQrData((prev) => {
        return {
          ...prev,
          publicKey: keys.publicKeyPem,
        };
      });
      // Set state or do something with the keys
    };

    worker.postMessage({ generateKeys: true });
  };

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
      setEmailError("Niepoprawny format e-mail");
    } else {
      setEmailError("");
    }

    return regex.test(loginData.email);
  };
  const handlePassword = () => {
    const { password } = loginData;
    if (password.length === 0) {
      setPasssError("Hasło zbyt krótkie");
      return false;
    }
    setPasssError("");
    return true;
  };

  const handleSubmit = (
    e?: React.MouseEvent<HTMLButtonElement, MouseEvent>
  ) => {
    if (e) e.preventDefault();
    if (handlePassword() && handleEmailSyntax()) {
      fetch(`http://127.0.0.1:3000/login`, {
        method: "POST",
        body: JSON.stringify({
          login: loginData.email,
          password: loginData.password,
          ...(twoFArequired && { code: twoFACode }),
        }),
        headers: {
          "Content-Type": "application/json", // This line is important
        },
      })
        .then(async (data) => {
          if (data.ok) {
            console.log(data);
            const jsonData = await data.json();
            localStorage.setItem("userData", JSON.stringify(jsonData));
            return navigate(`/userdata`);
          } else {
            const errorData = await data.json();
            throw {
              status: data.status,
              statusText: data.statusText,
              ...errorData,
            };
          }
        })
        .catch((err) => {
          console.error(err);
          if (err.codeRequired) {
            setTwoFArequired(true);
            setQrData((prev) => {
              prev.issuer = err.issuer;
              prev.label = err.label;
              return prev;
            });
          } else {
            toast.error(err.message || "Pojawił się błąd");
          }
        });
    }
  };

  useEffect(() => {
    console.log(socket);
    if (qrData.publicKey.length < 5) startKeyGenerationInWorker();
    socket.connect();

    socket.on("connect", async () => {
      setIsConnected(true);
    });
    socket.on("disconnect", () => {
      setIsConnected(false);
      console.log("disconected from socket");
    });
    socket.on("message", (message: string) => {
      console.log(message);
      if (message.includes("connId")) {
        const [_, id] = message.split("|");
        console.log("recieved websocket session id: ", id);
        setQrData((prev) => {
          prev.websocketId = id;
          return prev;
        });
      }
    });

    const handleSendCode = async (message: string) => {
      handleSendCodeDebounced(message);
    };

    socket.on("sendCode", handleSendCode);
    return () => {
      socket.off("connect");
      socket.off("disconnect");
      socket.off("message");
      socket.off("sendCode");
      socket.disconnect();
    };
  }, []);

  useEffect(() => {
    if (isTwoFACodeSet && twoFACode) {
      handleSubmit();
    }
    return () => {
      setIsTwoFACodeSet(false);
    };
  }, [isTwoFACodeSet]);

  const decryptData = async (data: string, privateKey: string) => {
    try {
      console.log("encrypted data: ", data);
      console.log("Decrypting private key (pem): ", privateKey);

      // Decrypt the data using the private key
      const key = forge.pki.privateKeyFromPem(privateKey);
      const decryptedText = key.decrypt(data, "RSA-OAEP");

      return decryptedText;
    } catch (error) {
      console.error("Decryption failed:", error);
      throw error;
    }
  };

  return (
    <main className="flex h-[100vh] bg-mainBg">
      <section className="w-1/2 m-auto flex justify-center items-center text-default-color">
        <article className="flex flex-col 2xl:w-1/2 w-3/4 ">
          <form action="#" className="w-full">
            {twoFArequired ? (
              <>
                <p className="mt-10 mb-5 text-xl text-center">
                  Zaloguj się do swojego konta
                </p>
                <input
                  className="w-full"
                  type="number"
                  name="2FACode"
                  placeholder="Kod 2FA"
                  value={twoFACode}
                  onChange={(e) => setTwoFACode(e.target.value)}
                />
                <button
                  onClick={(e) => handleSubmit(e)}
                  className="w-full gradient-button"
                >
                  Potwierdź
                </button>
                {isConnected && qrData.publicKey.length == 0 && (
                  <h3 className="w-full text-center mt-10 text-xl">
                    Połączono z serwerem przekaźnika. Generowanie kluczy
                    szyfrujących...
                  </h3>
                )}
                {isConnected && qrData.publicKey.length > 0 && (
                  <>
                    <h3 className="w-full text-center mt-10 text-xl">
                      Albo zeskanuj ten kod QR w aplikacji Open2FA
                    </h3>
                    <div className="flex justify-center items-center mt-5 w-2/3 mx-auto bg-white aspect-square">
                      <QRCode value={JSON.stringify(qrData)} />
                    </div>
                    {/* <p className="mt-5">relay url: {qrData.relayUrl}</p>
                    <p className="mt-1">websocket id: {qrData.websocketId}</p>
                    <p className="mt-5">issuer: {qrData.issuer}</p>
                    <p className="mt-1">websocket id: {qrData.websocketId}</p>
                    <p className="mt-1">
                      public key:{" "}
                      {qrData.publicKey ? qrData.publicKey : "GENERATING..."}
                    </p> */}
                  </>
                )}
              </>
            ) : (
              <>
                <p className="mt-10 mb-5 text-xl text-center">
                  Zaloguj się do swojego konta
                </p>
                <p className="w-full mb-1 pl-4 text-error text-sm">
                  {emailError}
                </p>
                <input
                  className="w-full mb-4"
                  type="email"
                  name="email"
                  placeholder="E-mail"
                  value={loginData.email}
                  onChange={(e) => handleForm(e)}
                  onBlur={() => handleEmailSyntax()}
                />
                <p className="w-full mb-1 pl-4 text-error text-sm">
                  {passError}
                </p>
                <input
                  className="w-full"
                  type="password"
                  name="password"
                  placeholder="Hasło"
                  value={loginData.password}
                  onChange={(e) => handleForm(e)}
                  onBlur={() => handlePassword()}
                />
                <button
                  onClick={(e) => handleSubmit(e)}
                  className="w-full gradient-button"
                >
                  Login
                </button>
                <div className="w-full flex justify-between 2xl:mt-[8rem] mt-[4rem] items-center">
                  <p>Nie masz konta?</p>
                  <button
                    onClick={() => navigate("/register")}
                    className="register-button"
                  >
                    Zarejestruj się
                  </button>
                </div>
              </>
            )}
          </form>
        </article>
      </section>
    </main>
  );
};
