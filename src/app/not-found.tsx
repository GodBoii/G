import Link from "next/link";
import { buttonClasses } from "@/components/ui/Button";

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center px-4 py-20 text-center sm:py-28">
      <p className="bg-linear-to-r from-fuchsia-400 to-amber-300 bg-clip-text font-display text-8xl font-extrabold tracking-tight text-transparent sm:text-9xl">
        404
      </p>
      <h1 className="mt-4 font-display text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
        This table doesn&apos;t exist
      </h1>
      <p className="mt-3 text-ink-muted">The page you were looking for isn&apos;t part of the arcade.</p>
      <Link href="/" className={`${buttonClasses("primary", "lg")} mt-8`}>
        Back to the lobby
      </Link>
    </div>
  );
}
