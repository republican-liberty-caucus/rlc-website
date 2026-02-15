import { Metadata } from 'next';
import Image from 'next/image';
import { MainNav } from '@/components/navigation/main-nav';
import { Footer } from '@/components/layout/footer';

export const metadata: Metadata = {
  title: 'Speakers Bureau',
  description: 'Republican Liberty Caucus speakers available for events and presentations.',
};

const speakers = [
  {
    name: 'John Dennis',
    title: 'RLC National Chair',
    location: 'San Francisco, CA',
    image:
      'https://images.leadconnectorhq.com/image/f_webp/q_80/r_1200/u_https://assets.cdn.filesafe.space/eKU9X5pMPSlIjG2USRoE/media/63a2d3bdd2454b4de826676e.jpeg',
    bio: 'John Dennis is a real estate investor and CEO of Foundation Real Estate in San Francisco. A longtime liberty Republican, Dennis has been a prominent voice for limited government, individual rights, and non-interventionism. He has extensive experience in media appearances and public speaking on behalf of the liberty movement within the GOP.',
    topics: [
      'Liberty within the Republican Party',
      'Limited government and fiscal responsibility',
      'Non-interventionist foreign policy',
      'Free market economics',
    ],
  },
  {
    name: 'Matt Nye',
    title: 'RLC National Treasurer & Immediate Past Chair',
    location: 'Brevard County, FL',
    image:
      'https://images.leadconnectorhq.com/image/f_webp/q_80/r_1200/u_https://assets.cdn.filesafe.space/eKU9X5pMPSlIjG2USRoE/media/6845d9325d6a598a19d68c19.jpeg',
    bio: 'Matt Nye is an entrepreneur and political activist with more than 30 years of experience in finance and technology. He served as National Chair of the RLC for a decade (2013\u20132023) and has been involved with the organization since 2007. Nye is a frequently sought expert for media on subjects like taxes, regulation, waste, fraud, abuse, and transparency.',
    topics: [
      'Grassroots political organizing',
      'Taxes, regulation, and government transparency',
      'The liberty movement and the GOP',
      'Technology and political activism',
    ],
  },
];

export default function SpeakersPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <MainNav />

      <section className="bg-rlc-blue py-16 text-white">
        <div className="container mx-auto px-4">
          <h1 className="text-2xl font-bold sm:text-3xl md:text-4xl">Speakers Bureau</h1>
          <p className="mt-4 text-xl text-white/90">
            RLC speakers available for your events
          </p>
        </div>
      </section>

      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-4xl">
            <p className="mb-12 text-lg text-muted-foreground">
              The Republican Liberty Caucus is the oldest continuously operating
              Republican liberty organization and has been &ldquo;the Conscience
              of the Republican Party&rdquo; since its inception in 1991. The
              following RLC speakers are available to speak on a variety of
              topics.
            </p>

            <div className="space-y-12">
              {speakers.map((speaker) => (
                <div
                  key={speaker.name}
                  className="flex flex-col items-center gap-8 rounded-lg border bg-card p-8 sm:flex-row sm:items-start"
                >
                  <div className="relative h-48 w-48 shrink-0 overflow-hidden rounded-lg">
                    <Image
                      src={speaker.image}
                      alt={speaker.name}
                      fill
                      unoptimized
                      className="object-cover"
                    />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold">{speaker.name}</h2>
                    <p className="mt-1 text-lg font-medium text-rlc-red">
                      {speaker.title}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {speaker.location}
                    </p>
                    <p className="mt-4 text-muted-foreground">{speaker.bio}</p>
                    <div className="mt-4">
                      <p className="text-sm font-semibold">Speaking Topics:</p>
                      <ul className="mt-1 list-inside list-disc text-sm text-muted-foreground">
                        {speaker.topics.map((topic) => (
                          <li key={topic}>{topic}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-12 rounded-lg border border-rlc-red/20 bg-rlc-red/5 p-6 text-center">
              <p className="text-muted-foreground">
                To book an RLC speaker for your event, contact us at{' '}
                <a
                  href="mailto:info@rlc.org"
                  className="font-medium text-rlc-red hover:underline"
                >
                  info@rlc.org
                </a>{' '}
                or call{' '}
                <a
                  href="tel:+18667525423"
                  className="font-medium text-rlc-red hover:underline"
                >
                  (866) 752-5423
                </a>
                .
              </p>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
