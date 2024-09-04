import { useSearchParams } from "react-router-dom";

export interface IUser {
  id: string;
  name: string;
}

export const UserData = ({ user }: { user: IUser }) => {
  let [searchParams, setSearchParams] = useSearchParams();
  return (
    <main className="flex h-[100vh] bg-mainBg">
      <section className="w-1/2 m-auto flex justify-center items-center text-default-color">
        <article className="flex flex-col 2xl:w-1/2 w-3/4 ">
          <h1 className="text-3xl text-center">User Data</h1>
          <p className="text-xl mt-5">id: {searchParams.get("name")}</p>
          <p className="text-xl mt-5">name: {searchParams.get("id")}</p>
        </article>
      </section>
    </main>
  );
};

UserData.defaultProps = {
  user: {
    id: "1",
    name: "example name",
  },
};
