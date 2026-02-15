import { MainNav } from '@/components/navigation/main-nav';
import { Footer } from '@/components/layout/footer';

interface WPContentPageProps {
  title: string;
  subtitle?: string;
  content: string;
  children?: React.ReactNode;
}

export function WPContentPage({ title, subtitle, content, children }: WPContentPageProps) {
  return (
    <div className="flex min-h-screen flex-col">
      <MainNav />

      <section className="bg-rlc-blue py-16 text-white">
        <div className="container mx-auto px-4">
          <h1 className="text-2xl font-bold sm:text-3xl md:text-4xl">{title}</h1>
          {subtitle && <p className="mt-4 text-xl text-white/90">{subtitle}</p>}
        </div>
      </section>

      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-4xl">
            <div
              className="prose prose-lg max-w-none dark:prose-invert prose-headings:text-foreground prose-a:text-rlc-red prose-a:no-underline hover:prose-a:underline prose-img:rounded-lg prose-img:w-full prose-img:h-auto"
              dangerouslySetInnerHTML={{ __html: content }}  /* content is sanitized server-side via sanitizeWPContent() */
            />
            {children}
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
