export default function EmbedLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-white p-4 text-sm">{children}</body>
    </html>
  );
}
