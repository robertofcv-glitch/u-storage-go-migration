import Slide4Founder from "@/components/pitchdeck/Slide4Founder";

export default function PitchSlide4() {
  return (
    <div
      data-testid="page-pitch-slide4"
      style={{
        width: "100vw",
        height: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#000",
      }}
    >
      <Slide4Founder />
    </div>
  );
}