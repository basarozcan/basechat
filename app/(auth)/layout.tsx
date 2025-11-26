import { Inter, Inter_Tight } from "next/font/google";
import Image from "next/image";

import RagieLogo from "@/components/ragie-logo";
import * as settings from "@/lib/server/settings";

const inter_tight = Inter_Tight({
  subsets: ["latin"],
  display: "swap",
});

const inter = Inter({ subsets: ["latin"] });

export default function Layout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="h-screen w-full flex flex-col items-center bg-white overflow-hidden">
      <div className="flex-1 w-full overflow-y-auto">
        <div className="w-full max-w-[442px] px-4 pt-10 mx-auto h-full flex flex-col items-center justify-center max-[460px]:px-8">
          <div className="flex items-center mb-16 w-full max-[460px]:justify-start max-[460px]:mr-6">
            <Image
              src="/images/title-logo.svg"
              alt={settings.APP_NAME}
              width={410}
              height={64}
              className="max-w-[410px] max-h-[64px] max-[460px]:max-w-[185px] max-[460px]:max-h-[24px]"
              priority
            />
          </div>
          <div className="flex flex-col items-center w-full">{children}</div>
        </div>
      </div>
    </div>
  );
}
