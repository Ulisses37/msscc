export default function StorageTest() {
  return (
    <div style={{ padding: "2rem" }}>
      <h1>MinIO Storage Test</h1>
      {/* Test direct storage access without routing the request through image optimization. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="https://msscc-storage.uahomeserver.net/msscc-media/public/northfall.png"
        alt="test"
        style={{ maxWidth: "600px" }}
      />
    </div>
  );
}
