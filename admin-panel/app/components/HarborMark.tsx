import Link from "next/link";
import { PRODUCT_NAME } from "@/lib/brand";

export function HarborMark({ onDark = false }: { onDark?: boolean }) {
  return (
    <Link href="/" className={`inline-flex items-center ${onDark ? "text-white" : "text-amber-400"}`}>
      <img src="/opas.png" alt={PRODUCT_NAME} className="h-9 w-auto" />
    </Link>
  );
}
