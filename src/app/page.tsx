import Image from "next/image";
import Background from "@/components/Background";
import BookingForm from "@/components/BookingForm";
import { ChartIcon, GearIcon, TeamIcon } from "@/components/Icons";

const trust = [
  { icon: <GearIcon />, lines: ["Built around", "your workflow"] },
  { icon: <TeamIcon />, lines: ["Designed", "for your team"] },
  { icon: <ChartIcon />, lines: ["Scalable", "as you grow"] },
];

export default function Home() {
  return (
    <>
      <Background />

      <main className="page">
        <header>
          <Image
            className="brand"
            src="/logo.png"
            alt="Pixie Webs"
            width={830}
            height={223}
            priority
          />
        </header>

        <div className="hero">
          <h1 className="headline">
            Let&rsquo;s build a system around your <em>business.</em>
          </h1>

          <BookingForm />

          <div className="trust">
            {trust.map((item) => (
              <div className="trust-item" key={item.lines[0]}>
                <span className="trust-icon">{item.icon}</span>
                <span className="trust-text">
                  {item.lines[0]}
                  <br />
                  {item.lines[1]}
                </span>
              </div>
            ))}
          </div>
        </div>

        <footer className="footer">&copy; Pixie Webs</footer>
      </main>
    </>
  );
}
