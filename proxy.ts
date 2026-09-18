import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

export function proxy(request: NextRequest) {
	const sessionCookie = getSessionCookie(request);

	if (!sessionCookie) {
		const loginUrl = new URL("/login", request.url);
		loginUrl.searchParams.set(
			"callbackUrl",
			request.nextUrl.pathname + request.nextUrl.search
		);
		return NextResponse.redirect(loginUrl);
	}

	return NextResponse.next();
}

export const config = {
	matcher: ["/dashboard/:path*", "/billing/:path*"],
};