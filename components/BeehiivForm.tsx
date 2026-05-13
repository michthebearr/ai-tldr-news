"use client";

import Script from "next/script";

export default function BeehiivForm() {
  return (
    <div className="beehiiv-wrap">
      <div data-beehiiv-form="9a078a90-0315-4ef5-a204-773a92f9e8ab" />
      <Script
        src="https://subscribe-forms.beehiiv.com/v3/loader.js"
        data-beehiiv-form="9a078a90-0315-4ef5-a204-773a92f9e8ab"
        strategy="afterInteractive"
      />
    </div>
  );
}
