import { NationalEntry } from "../components/national-entry";

export const dynamic = "force-dynamic";

export default function Home() {
  const env = process.env.APP_ENV;
  const demo =
    (env === "local" || env === "staging") &&
    Boolean(process.env.DEMO_API_TOKEN);
  const mode = demo
    ? "demo"
    : process.env.NODE_ENV === "production"
      ? "none"
      : "mock";
  return <NationalEntry mode={mode} />;
}
