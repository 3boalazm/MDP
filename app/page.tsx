import { Hero } from "@/app/components/Hero";
import { Steps } from "@/app/components/Steps";
import { StemsShowcase } from "@/app/components/StemsShowcase";
import { Faq } from "@/app/components/Faq";
import { Footer } from "@/app/components/Footer";

export default function Home() {
  return (
    <>
      <Hero />
      <Steps />
      <StemsShowcase />
      <Faq />
      <Footer />
    </>
  );
}
