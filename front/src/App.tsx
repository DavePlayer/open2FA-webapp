import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

export const App = () => {
  const navigate = useNavigate();
  useEffect(() => {
    navigate("/login");
  });
  return <div>App</div>;
};
