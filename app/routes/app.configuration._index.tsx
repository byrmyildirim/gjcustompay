import { redirect } from "@remix-run/node";
import type { LoaderFunctionArgs } from "@remix-run/node";

export const loader = async ({ request }: LoaderFunctionArgs) => {
    // /app/configuration adresine gelindiğinde ana sayfaya (Dashboard) yönlendirir
    return redirect("/app");
};
