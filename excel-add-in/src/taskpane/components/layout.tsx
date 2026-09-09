import { twMerge } from "tailwind-merge";

interface Props {
  children: React.ReactNode;
  bgClasses?: string;
}

export default function Layout(props: Props) {
  const { children, bgClasses } = props;

  return (
    <>
      <div
        className={twMerge(
          "bg-dark-900 fixed left-0 top-0 -z-10 h-[100vh] w-[100vw]",
          bgClasses,
        )}
      />
      <div className="flex justify-center p-12">
        <div className="w-full max-w-sm">{children}</div>
      </div>
    </>
  );
}
