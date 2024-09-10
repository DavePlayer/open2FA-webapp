import { useSearchParams } from "react-router-dom";

export interface IUser {
  id: string;
  name: string;
}

export const UserData = () => {
  const userData = JSON.parse(localStorage.getItem("userData") || "");
  return (
    <main className="flex h-[100vh] bg-mainBg">
      <section className="w-1/2 m-auto flex justify-center items-center text-default-color">
        <article className="flex flex-col 2xl:w-1/2 w-3/4 ">
          <h1 className="text-3xl text-center">User Data</h1>
          <p className="text-xl mt-5">id: {userData?.id || 9999}</p>
          <p className="text-xl mt-5">name: {userData?.email || "no name"}</p>
        </article>
      </section>
    </main>
  );
};
