import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { socket } from "../socket";
import QRCode from "react-qr-code";

interface QrCodeData {
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
  const navigate = useNavigate();
  const [isConnected, setIsConnected] = useState(socket.connected);
  const [qrData, setQrData] = useState<QrCodeData>({
    publicKey: "",
    relayUrl: "10.0.0.189:9999", // TODO make relay listen on ipv4 or on every network card
    websocketId: "",
    issuer: "",
    label: "",
  });

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
            toast.error(err.message || "An error occurred");
          }
        });
    }
  };

  useEffect(() => {
    socket.on("connect", () => {
      setIsConnected(true);
    });
    socket.on("disconnect", () => setIsConnected(false));
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
    socket.on("sendCode", (message) => {
      const digits = parseInt(message);
      if (digits) {
        console.log("recieved 2faCode: ", digits);
      }
    });
    generateRsaKeys();
    return () => {
      socket.off("connect");
      socket.off("disconnect");
      socket.off("message");
    };
  }, []);

  // Helper function to convert ArrayBuffer to Base64 string
  const arrayBufferToBase64 = (buffer: ArrayBuffer) => {
    let binary = "";
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  };

  const generateRsaKeys = async () => {
    const keyPair = await window.crypto.subtle.generateKey(
      {
        name: "RSA-OAEP",
        modulusLength: 2048,
        publicExponent: new Uint8Array([1, 0, 1]), // 0x010001
        hash: "SHA-256",
      },
      true, // Whether the keys can be extracted
      ["encrypt", "decrypt"] // Key usage
    );

    // Export the public key as an ArrayBuffer
    const exportPublicKey = async (key: CryptoKey) => {
      const exported = await window.crypto.subtle.exportKey("spki", key); // spki for public key
      return exported;
    };

    const publicKeyBuffer = await exportPublicKey(keyPair.publicKey);

    // Convert the ArrayBuffer to a Base64 string (safe for QR codes)
    const publicKeyBase64 = arrayBufferToBase64(publicKeyBuffer);

    // Save the base64 encoded public key in your QR data
    setQrData((prev) => {
      prev.publicKey = publicKeyBase64; // Store the base64 string instead of PEM
      return prev;
    });

    console.log("Public Key (Base64):", publicKeyBase64);
  };

  const decryptData = async (
    encryptedDataBase64: string,
    privateKey: CryptoKey
  ): Promise<string> => {
    const encryptedData = Uint8Array.from(atob(encryptedDataBase64), (c) =>
      c.charCodeAt(0)
    ); // Decode base64 to bytes

    try {
      const decrypted = await window.crypto.subtle.decrypt(
        {
          name: "RSA-OAEP",
        },
        privateKey, // Use the private key here
        encryptedData // The encrypted data
      );

      // Convert decrypted ArrayBuffer back to string
      const decoder = new TextDecoder();
      return decoder.decode(decrypted);
    } catch (error) {
      console.error("Decryption failed:", error);
      return "";
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
                  Please login to your account
                </p>
                <input
                  className="w-full"
                  type="number"
                  name="2FACode"
                  placeholder="2FA Code"
                  value={twoFACode}
                  onChange={(e) => setTwoFACode(e.target.value)}
                />
                <button
                  onClick={(e) => handleSubmit(e)}
                  className="w-full gradient-button"
                >
                  Confirm
                </button>
                {isConnected && (
                  <>
                    <h3 className="w-full text-center mt-10 text-xl">
                      Or scan this qr on Open2FA app
                    </h3>
                    <div className="flex justify-center items-center mt-5 w-2/3 mx-auto bg-white aspect-square">
                      <QRCode value={JSON.stringify(qrData)} />
                    </div>
                    <p className="mt-5">relay url: {qrData.relayUrl}</p>
                    <p className="mt-1">websocket id: {qrData.websocketId}</p>
                    <p className="mt-5">issuer: {qrData.issuer}</p>
                    <p className="mt-1">websocket id: {qrData.websocketId}</p>
                    <p className="mt-1">public key: {qrData.publicKey}</p>
                  </>
                )}
              </>
            ) : (
              <>
                <p className="mt-10 mb-5 text-xl text-center">
                  Please login to your account
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
                  placeholder="Password"
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
                  <p>Don't have an account?</p>
                  <button
                    onClick={() => navigate("/register")}
                    className="register-button"
                  >
                    Register
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
