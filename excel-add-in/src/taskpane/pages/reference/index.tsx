export default function Page() {
  return (
    <div style={{ position: "relative", width: "100vw", height: "100vh" }}>
      <iframe
        src="https://docs.openbb.co/excel/reference"
        style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%" }}
        allowFullScreen
        title="Embedded Content"
      ></iframe>
    </div>
  );
}
