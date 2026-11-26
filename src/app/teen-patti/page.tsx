import type { Metadata } from "next";
import { TeenPattiGame } from "@/components/games/TeenPattiGame";

export const metadata: Metadata = {
  title: "Teen Patti",
  description: "Play a heads-up three-card Teen Patti showdown at House 37.",
};

export default function TeenPattiPage() {
  return <TeenPattiGame />;
}
