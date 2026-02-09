import NextAuth from "next-auth"
import TwitterProvider from "next-auth/providers/twitter"

const handler = NextAuth({
  providers: [
    TwitterProvider({
      clientId: process.env.TWITTER_CLIENT_ID!,
      clientSecret: process.env.TWITTER_CLIENT_SECRET!,
      version: "2.0",
    }),
  ],
  callbacks: {
    async jwt({ token, account, profile }) {
      // Save Twitter username in token
      if (account && profile) {
        token.twitterUsername = (profile as any).data?.username || (profile as any).screen_name
      }
      return token
    },
    async session({ session, token }) {
      // Expose Twitter username in session
      (session as any).twitterUsername = token.twitterUsername
      return session
    },
  },
})

export { handler as GET, handler as POST }
