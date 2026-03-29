/**
 * ============================================================
 * VANDERLEEST TRAILERS - SITE CONTENT
 * ============================================================
 * Edit this file to update all website text content.
 * All content is centralized here for easy maintenance.
 * ============================================================
 */

export const SITE_INFO = {
  name: 'VanderLeest Trailer Sales',
  shortName: 'VanderLeest',
  tagline: "Northeastern Wisconsin's Trailer Dealer",
  phone: '920-471-9076',
  phoneFormatted: '920.471.9076',
  email: '',
  address: {
    street: '535 Munsert Ave',
    city: 'Oconto Falls',
    state: 'WI',
    zip: '54154',
    full: '535 Munsert Ave, Oconto Falls, WI 54154',
  },
  hours: 'By Appointment Only',
  mapCoords: {
    lat: 44.8858739261,
    lng: -88.1380644073,
  },
  social: {
    facebook: 'https://www.facebook.com/Vanderleesttrailers/',
    instagram: 'https://www.instagram.com/vanderleesttrailersales/',
  },
  logo: '/uploads/site/logos/vanderleest-logo.png',
  logoHeader: '/uploads/site/logos/vanderleest-logo.png',
};

export const NAV_LINKS = [
  { label: 'Home', route: '/' },
  { label: 'About', route: '/about' },
  {
    label: 'Inventory',
    route: '/inventory',
    children: [
      { label: 'All Inventory', route: '/inventory' },
      { label: 'Aluminum Trailers', route: '/inventory/aluminum-trailers' },
      { label: 'Aluminum Enclosed', route: '/inventory/aluminum-enclosed-trailers' },
      { label: 'Car & Equipment Haulers', route: '/inventory/car-equipment-haulers' },
      { label: 'Dump Trailers', route: '/inventory/dump-trailers' },
      { label: 'Enclosed Trailers', route: '/inventory/enclosed-trailers' },
      { label: 'Gooseneck Trailers', route: '/inventory/gooseneck-trailers' },
      { label: 'Steel Utility Trailers', route: '/inventory/steel-utility-trailers' },
    ],
  },
  { label: 'Brands', route: '/brands' },
  { label: 'Trailer Finder', route: '/trailer-finder' },
  { label: 'Services', route: '/services' },
  { label: 'Custom Trailers', route: '/custom-trailers' },
  { label: 'Financing', route: '/financing' },
  { label: 'Reviews', route: '/reviews' },
  { label: 'Contact', route: '/contact' },
];

export const HOME_CONTENT = {
  hero: {
    heading: 'Building Relationships Comes First. Selling Trailers Comes Second.',
    subheading: 'Offering the best customer relationship, while selling the best trailers.',
    backgroundImage: '/uploads/site/heroes/hero-slide3.jpg',
    mobileImage: '/uploads/site/heroes/hero-mobile.jpg',
    desktopImage: '/uploads/site/heroes/hero-desktop.jpg',
    ctaText: 'View Inventory',
    ctaLink: '/inventory',
    secondaryCtaText: 'Contact Us',
    secondaryCtaLink: '/contact',
  },
  intro: {
    heading: 'Your Trusted Trailer Partner',
    text: "At VanderLeest Trailer Sales, we're proud of the trailers we offer, but we're even prouder of the relationships we build. Our goal is to get to know you and to use our knowledge and experience to make sure we provide what you need — not just what happens to be on our lot.",
    text2: 'Whether you need a trailer for work, adventures, or personal projects, we help you identify exactly what suits your hauling needs. And our support doesn\'t stop at the sale — we provide ongoing help with parts, accessories, maintenance, and repairs.',
  },
  services: {
    heading: 'VanderLeest Services',
    subheading: 'Keeping Your Trailer in Tip-Top Shape',
    ctaText: 'Learn More',
    ctaLink: '/services',
  },
};

export const ABOUT_CONTENT = {
  hero: {
    heading: 'Our Story',
    subheading: 'Built on relationships since 2018',
    backgroundImage: '/uploads/site/heroes/hero-slide3.jpg',
  },
  story: {
    heading: 'How It All Started',
    paragraphs: [
      'VanderLeest Trailer Sales was established in 2018, beginning with just three small single-axle trailers. The business has grown to become a leading dealer in Northeastern Wisconsin by prioritizing relationship-building over transactional sales.',
      'We emphasize outstanding customer service and quality buying experiences. We stock trailers from top manufacturers: Black Rhino, Gatormade, Maxx-D, Retco, DuraBull, and Rock Solid Cargo.',
    ],
  },
  founder: {
    name: 'Matt VanderLeest',
    title: 'Owner',
    image: '/uploads/site/founder/matt-grandfather.jpg',
    bio: [
      'Matt launched the business while maintaining other work, including firewood sales and full-time employment elsewhere. He transitioned to full-time trailer sales after recognizing his passion for personal growth and industry challenges.',
      'His grandfather has been instrumental in the business journey, accompanying him on manufacturer pickup trips. Outside work, Matt enjoys snowmobiling, ATV-ing, camping, and spending time with family and friends.',
    ],
  },
};

export const SERVICES_CONTENT = {
  hero: {
    heading: 'Tow With Confidence',
    subheading: 'We\'ll fix it even if we didn\'t sell it to you!',
    description: 'VanderLeest offers service for all makes and models of trailers.',
    backgroundImage: '/uploads/site/heroes/services-header.jpg',
  },
  services: [
    {
      name: 'Welding',
      icon: '/uploads/site/icons/welding.png',
      description: 'Structural repairs including minor frame damage restoration and component reinforcement. We get your trailer back to full strength.',
    },
    {
      name: 'Painting',
      icon: '/uploads/site/icons/painting.png',
      description: 'Protection against rust, corrosion, UV damage, and customization options for trailer renewal. Keep your trailer looking great.',
    },
    {
      name: 'Electrical',
      icon: '/uploads/site/icons/electrical.png',
      description: 'Trailer rewiring, light repair, and malfunctioning wiring corrections. Stay safe and road-legal.',
    },
    {
      name: 'Bearings & Brakes',
      icon: '/uploads/site/icons/brakes.png',
      description: 'Bearing lubrication, repacking, replacement, and brake inspections and maintenance. Keeping you rolling safely.',
    },
    {
      name: 'Customization',
      icon: '/uploads/site/icons/custom.png',
      description: 'We build custom solutions to fit your specific requirements. From generator boxes to food trailers, we can make it happen.',
      link: '/custom-trailers',
    },
  ],
};

export const CUSTOM_TRAILERS_CONTENT = {
  hero: {
    heading: 'Custom Trailers',
    subheading: 'Built to your exact specifications',
    backgroundImage: '/uploads/site/heroes/services-header.jpg',
  },
  intro: {
    heading: 'Trailer Customizations',
    text: "Here are a few of the Trailer Customizations we've done for our customers to fit their specific requirements.",
  },
  gallery: [
    {
      title: 'AC Unit Installation',
      image: '/uploads/site/custom/generator-box.jpg',
      description: 'Climate control system integration',
    },
    {
      title: 'Custom Generator Box',
      image: '/uploads/site/custom/generator-box.jpg',
      description: 'Dedicated power generation enclosure',
    },
    {
      title: 'Generator Box in V-Nose',
      image: '/uploads/site/custom/generator-box.jpg',
      description: 'Space-efficient generator placement in trailer front',
    },
    {
      title: 'Food Trailers',
      image: '/uploads/site/custom/generator-box.jpg',
      description: 'Mobile food service configurations',
    },
    {
      title: 'Rear Spoiler LED',
      image: '/uploads/site/custom/generator-box.jpg',
      description: 'Aerodynamic enhancement with LED lighting',
    },
    {
      title: 'Window Options',
      image: '/uploads/site/custom/generator-box.jpg',
      description: 'Various window configurations and styles',
    },
  ],
};

export const FINANCING_CONTENT = {
  hero: {
    heading: 'Financing Options',
    subheading: 'A seamless and stress-free trailer purchasing experience',
    backgroundImage: '/uploads/site/heroes/financing-header.jpg',
  },
  intro: {
    heading: 'Flexible Financing Solutions',
    text: 'We work with multiple financing institutions to provide flexible options that suit your needs and budget.',
  },
  partners: [
    {
      name: 'Marine Credit Union',
      creditRequirement: 'Good to Excellent Credit (640+)',
      features: ['Local and personalized service', 'Competitive rates', 'Easy process'],
      applicationUrl: 'https://marinecreditunion.my.site.com',
      logo: '',
    },
    {
      name: 'Trailer Solutions Financial',
      creditRequirement: 'Good to Excellent Credit',
      features: ['Wide range of lenders', 'More financing options', 'Competitive rates'],
      applicationUrl: 'https://get-started.trailersolutionsfl.com',
      logo: '',
    },
    {
      name: 'ClickLease',
      creditRequirement: 'All Credit Scores Welcome',
      features: [
        '$500 - $30,000 range',
        'Decision in seconds',
        'No documents required',
        'No time-in-business requirements',
        '5-month early purchase option',
      ],
      applicationUrl: 'https://app.clicklease.com',
      logo: '/uploads/site/logos/clicklease-logo.png',
    },
  ],
};

export const CONTACT_CONTENT = {
  hero: {
    heading: 'Get In Touch',
    subheading: "We'd love to hear from you",
    backgroundImage: '/uploads/site/heroes/contact-header.jpg',
  },
  form: {
    heading: 'Send Us a Message',
    successMessage: 'Thank you for reaching out! We will contact you within 1 to 2 business days!',
    fields: [
      { name: 'name', label: 'Name', type: 'text', required: true },
      { name: 'phone', label: 'Phone Number', type: 'tel', required: true },
      { name: 'email', label: 'Email Address', type: 'email', required: true },
      { name: 'message', label: 'Message', type: 'textarea', required: true },
    ],
  },
};

export const FAQ_CONTENT = [
  {
    question: 'How do I determine the best trailer for my needs?',
    answer: 'Consider the size, weight capacity, and what you\'ll be hauling. We\'re happy to help you figure out the perfect trailer — give us a call or stop by!',
  },
  {
    question: 'Do you offer financing?',
    answer: 'Yes! We work with multiple financing partners including Marine Credit Union, Trailer Solutions Financial, and ClickLease to offer flexible options for all credit levels.',
  },
  {
    question: 'What does GVWR mean?',
    answer: 'GVWR stands for Gross Vehicle Weight Rating. It\'s the maximum loaded weight of the trailer plus its cargo, as specified by the manufacturer.',
  },
  {
    question: 'Do you service trailers you didn\'t sell?',
    answer: 'Absolutely! We service all makes and models of trailers, regardless of where they were purchased.',
  },
];

export const TRAILER_BRANDS = [
  { name: 'Black Rhino', slug: 'black-rhino', website: 'https://blackrhinotrailer.com' },
  { name: 'Maxx-D', slug: 'maxx-d', website: 'https://maxxdtrailers.com' },
  { name: 'Gatormade', slug: 'gatormade', website: 'https://www.gatormade.com' },
  { name: 'Retco', slug: 'retco', website: 'https://retcotrailers.wordpress.com' },
  { name: 'DuraBull', slug: 'durabull', website: 'https://www.durabulltrailers.com' },
  { name: 'Rock Solid Cargo', slug: 'rock-solid-cargo', website: 'https://rocksolidcargo.com' },
];

export const TRAILER_CATEGORIES = [
  {
    name: 'Aluminum Trailers',
    slug: 'aluminum-trailers',
    image: '/uploads/site/categories/aluminum-trailers.jpeg',
    description: 'Lightweight and durable aluminum trailers for every need.',
  },
  {
    name: 'Aluminum Enclosed',
    slug: 'aluminum-enclosed-trailers',
    image: '/uploads/site/categories/aluminum-enclosed.jpeg',
    description: 'Protected cargo hauling with premium aluminum construction.',
  },
  {
    name: 'Car & Equipment Haulers',
    slug: 'car-equipment-haulers',
    image: '/uploads/site/categories/car-equipment-haulers.jpeg',
    description: 'Heavy-duty flatbed trailers for vehicles and equipment.',
  },
  {
    name: 'Dump Trailers',
    slug: 'dump-trailers',
    image: '/uploads/site/categories/dump-trailers.jpeg',
    description: 'Hydraulic dump trailers from 10K to 18K GVWR.',
  },
  {
    name: 'Enclosed Trailers',
    slug: 'enclosed-trailers',
    image: '/uploads/site/categories/enclosed-trailers.jpeg',
    description: 'Rock Solid Cargo enclosed trailers with premium features.',
  },
  {
    name: 'Gooseneck Trailers',
    slug: 'gooseneck-trailers',
    image: '/uploads/site/categories/gooseneck-trailers.jpeg',
    description: 'High-capacity gooseneck trailers for serious hauling.',
  },
  {
    name: 'Steel Utility Trailers',
    slug: 'steel-utility-trailers',
    image: '/uploads/site/categories/steel-utility.jpeg',
    description: 'Versatile utility trailers starting at $1,490.',
  },
];

export const REVIEWS = [
  {
    name: 'Customer',
    rating: 5,
    text: 'Professional and kind experience — the staff went beyond the call of duty to make sure everything was perfect.',
  },
  {
    name: 'Customer',
    rating: 5,
    text: 'Matt was incredibly helpful in finding the right trailer for our needs. Great selection and fair pricing.',
  },
  {
    name: 'Customer',
    rating: 5,
    text: 'Outstanding customer service. They customized our trailer exactly how we wanted it. Highly recommend!',
  },
  {
    name: 'Customer',
    rating: 5,
    text: 'Responsive communication and quality trailers. VanderLeest is the best trailer dealer in the area.',
  },
  {
    name: 'Customer',
    rating: 5,
    text: 'Great experience from start to finish. They helped us with financing and had the trailer ready ahead of schedule.',
  },
  {
    name: 'Customer',
    rating: 5,
    text: 'Exceptional pre-holiday support — they went above and beyond to get our trailer ready in time.',
  },
];

export const IMAGES = {
  hero: {
    home: '/uploads/site/heroes/hero-slide3.jpg',
    homeMobile: '/uploads/site/heroes/hero-mobile.jpg',
    homeDesktop: '/uploads/site/heroes/hero-desktop.jpg',
    services: '/uploads/site/heroes/services-header.jpg',
    inventory: '/uploads/site/heroes/inventory-header.jpg',
    financing: '/uploads/site/heroes/financing-header.jpg',
    contact: '/uploads/site/heroes/contact-header.jpg',
    faq: '/uploads/site/heroes/faq-photo.jpg',
  },
  serviceIcons: {
    welding: '/uploads/site/icons/welding.png',
    painting: '/uploads/site/icons/painting.png',
    electrical: '/uploads/site/icons/electrical.png',
    brakes: '/uploads/site/icons/brakes.png',
    custom: '/uploads/site/icons/custom.png',
  },
  logos: {
    main: '/uploads/site/logos/vanderleest-logo.png',
    header: '/uploads/site/logos/vanderleest-logo.png',
    headerAlt: '/uploads/site/logos/logo-header-alt.png',
    footer: '/uploads/site/logos/logo-footer.png',
    maxxd: '/uploads/site/logos/maxx-d-logo.png',
    clicklease: '/uploads/site/logos/clicklease-logo.png',
  },
  founder: '/uploads/site/founder/matt-grandfather.jpg',
  reviews: [
    '/uploads/site/reviews/review-1.jpg',
    '/uploads/site/reviews/review-2.jpg',
    '/uploads/site/reviews/review-3.jpg',
  ],
};
