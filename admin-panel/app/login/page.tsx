import { cookies } from "next/headers";
import { redirect } from "next/navigation";

async function loginAction(formData: FormData) {
  "use server";
  const password = formData.get("password") as string;

  if (password && password === process.env.ADMIN_PANEL_PASSWORD) {
    const cookieStore = await cookies();
    cookieStore.set("wtb_admin_session", "authenticated", {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 8,
    });
    redirect("/");
  }

  redirect("/login?error=1");
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;

  return (
    <div className="min-h-screen flex items-center justify-center bg-black px-4">
      <form
        action={loginAction}
        className="bg-neutral-900 border border-neutral-800 rounded-lg p-8 w-full max-w-sm"
      >
        <h1 className="font-display text-xl text-amber-400 uppercase tracking-wide mb-6 text-center">
          WTB Admin
        </h1>
        {params.error && (
          <p className="text-red-400 text-sm mb-4 text-center">
            Incorrect password — try again.
          </p>
        )}
        <label className="block mb-5">
          <span className="text-sm text-neutral-400">Password</span>
          <input
            type="password"
            name="password"
            autoFocus
            className="mt-1 w-full bg-black border border-neutral-700 rounded-md px-3 py-2 text-sm text-neutral-100 focus:outline-none focus:border-amber-500"
          />
        </label>
        <button
          type="submit"
          className="w-full bg-amber-500 text-black font-medium px-4 py-2 rounded-md hover:bg-amber-400 transition"
        >
          Log in
        </button>
      </form>
    </div>
  );
}