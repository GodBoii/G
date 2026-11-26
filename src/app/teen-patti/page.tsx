import type { Metadata } from "next";
import { TeenPattiGame } from "@/components/games/TeenPattiGame";

export const metadata: Metadata = {
  title: "Teen Patti",
  description: "Play three-card Teen Patti showdowns with virtual chips.",
};

export default function TeenPattiPage() {
  return <TeenPattiGame />;
}
