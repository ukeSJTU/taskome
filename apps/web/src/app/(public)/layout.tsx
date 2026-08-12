import Header from "@/components/header";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-rows-[auto_1fr] h-svh">
      <Header />
      {children}
    </div>
  );
}
