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
  logo: 'https://vanderleesttrailers.com/wp-content/uploads/2024/02/VanderLeest-logo-FINAL-2-2.png',
  logoHeader: 'https://vanderleesttrailers.com/wp-content/uploads/2024/02/VanderLeest-logo-FINAL-2-2.png',
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
    backgroundImage: 'https://vanderleesttrailers.com/wp-content/uploads/2025/03/Hero-slide3.jpg',
    mobileImage: 'https://vanderleesttrailers.com/wp-content/uploads/2023/06/Vanderleest_Hero_Mobile.jpg',
    desktopImage: 'https://vanderleesttrailers.com/wp-content/uploads/2023/06/Vanderleest_Hero.jpg',
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
    backgroundImage: 'https://vanderleesttrailers.com/wp-content/uploads/2025/03/Hero-slide3.jpg',
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
    image: 'https://vanderleesttrailers.com/wp-content/uploads/2025/03/Matt-Grandfather.jpg',
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
    backgroundImage: 'https://vanderleesttrailers.com/wp-content/uploads/2025/03/services_header-2.jpg',
  },
  services: [
    {
      name: 'Welding',
      icon: 'https://vanderleesttrailers.com/wp-content/uploads/2025/03/Icons_welding-1.png',
      description: 'Structural repairs including minor frame damage restoration and component reinforcement. We get your trailer back to full strength.',
    },
    {
      name: 'Painting',
      icon: 'https://vanderleesttrailers.com/wp-content/uploads/2025/03/Icons_painting-1.png',
      description: 'Protection against rust, corrosion, UV damage, and customization options for trailer renewal. Keep your trailer looking great.',
    },
    {
      name: 'Electrical',
      icon: 'https://vanderleesttrailers.com/wp-content/uploads/2025/03/Icons_electrical-1.png',
      description: 'Trailer rewiring, light repair, and malfunctioning wiring corrections. Stay safe and road-legal.',
    },
    {
      name: 'Bearings & Brakes',
      icon: 'https://vanderleesttrailers.com/wp-content/uploads/2025/03/Icons_brakes-1.png',
      description: 'Bearing lubrication, repacking, replacement, and brake inspections and maintenance. Keeping you rolling safely.',
    },
    {
      name: 'Customization',
      icon: 'https://vanderleesttrailers.com/wp-content/uploads/2025/03/Custom.png',
      description: 'We build custom solutions to fit your specific requirements. From generator boxes to food trailers, we can make it happen.',
      link: '/custom-trailers',
    },
  ],
};

export const CUSTOM_TRAILERS_CONTENT = {
  hero: {
    heading: 'Custom Trailers',
    subheading: 'Built to your exact specifications',
    backgroundImage: 'https://vanderleesttrailers.com/wp-content/uploads/2025/03/services_header-2.jpg',
  },
  intro: {
    heading: 'Trailer Customizations',
    text: "Here are a few of the Trailer Customizations we've done for our customers to fit their specific requirements.",
  },
  gallery: [
    {
      title: 'AC Unit Installation',
      image: 'https://vanderleesttrailers.com/wp-content/uploads/2025/03/Custom-Genertator-Box-.jpg',
      description: 'Climate control system integration',
    },
    {
      title: 'Custom Generator Box',
      image: 'https://vanderleesttrailers.com/wp-content/uploads/2025/03/Custom-Genertator-Box-.jpg',
      description: 'Dedicated power generation enclosure',
    },
    {
      title: 'Generator Box in V-Nose',
      image: 'https://vanderleesttrailers.com/wp-content/uploads/2025/03/Custom-Genertator-Box-.jpg',
      description: 'Space-efficient generator placement in trailer front',
    },
    {
      title: 'Food Trailers',
      image: 'https://vanderleesttrailers.com/wp-content/uploads/2025/03/Custom-Genertator-Box-.jpg',
      description: 'Mobile food service configurations',
    },
    {
      title: 'Rear Spoiler LED',
      image: 'https://vanderleesttrailers.com/wp-content/uploads/2025/03/Custom-Genertator-Box-.jpg',
      description: 'Aerodynamic enhancement with LED lighting',
    },
    {
      title: 'Window Options',
      image: 'https://vanderleesttrailers.com/wp-content/uploads/2025/03/Custom-Genertator-Box-.jpg',
      description: 'Various window configurations and styles',
    },
  ],
};

export const FINANCING_CONTENT = {
  hero: {
    heading: 'Financing Options',
    subheading: 'A seamless and stress-free trailer purchasing experience',
    backgroundImage: 'https://vanderleesttrailers.com/wp-content/uploads/2025/03/financing_header.jpg',
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
      logo: 'https://vanderleesttrailers.com/wp-content/uploads/2025/03/click-lease-logo.png',
    },
  ],
};

export const CONTACT_CONTENT = {
  hero: {
    heading: 'Get In Touch',
    subheading: "We'd love to hear from you",
    backgroundImage: 'https://vanderleesttrailers.com/wp-content/uploads/2025/03/contact_header-1.jpg',
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
  { name: 'Black Rhino', slug: 'black-rhino' },
  { name: 'Maxx-D', slug: 'maxx-d' },
  { name: 'Gatormade', slug: 'gatormade' },
  { name: 'Retco', slug: 'retco' },
  { name: 'DuraBull', slug: 'durabull' },
  { name: 'Rock Solid Cargo', slug: 'rock-solid-cargo' },
];

export const TRAILER_CATEGORIES = [
  {
    name: 'Aluminum Trailers',
    slug: 'aluminum-trailers',
    image: 'https://vanderleesttrailers.com/wp-content/uploads/2026/03/IMG_5552-scaled-e1773243644670.jpeg',
    description: 'Lightweight and durable aluminum trailers for every need.',
  },
  {
    name: 'Aluminum Enclosed',
    slug: 'aluminum-enclosed-trailers',
    image: 'https://vanderleesttrailers.com/wp-content/uploads/2026/02/IMG_5229-scaled.jpeg',
    description: 'Protected cargo hauling with premium aluminum construction.',
  },
  {
    name: 'Car & Equipment Haulers',
    slug: 'car-equipment-haulers',
    image: 'https://vanderleesttrailers.com/wp-content/uploads/2025/08/IMG_3816-scaled.jpeg',
    description: 'Heavy-duty flatbed trailers for vehicles and equipment.',
  },
  {
    name: 'Dump Trailers',
    slug: 'dump-trailers',
    image: 'https://vanderleesttrailers.com/wp-content/uploads/2025/10/IMG_4349-scaled-e1761789247583.jpeg',
    description: 'Hydraulic dump trailers from 10K to 18K GVWR.',
  },
  {
    name: 'Enclosed Trailers',
    slug: 'enclosed-trailers',
    image: 'https://vanderleesttrailers.com/wp-content/uploads/2026/02/IMG_5169-scaled.jpeg',
    description: 'Rock Solid Cargo enclosed trailers with premium features.',
  },
  {
    name: 'Gooseneck Trailers',
    slug: 'gooseneck-trailers',
    image: 'https://vanderleesttrailers.com/wp-content/uploads/2025/10/IMG_4360-scaled.jpeg',
    description: 'High-capacity gooseneck trailers for serious hauling.',
  },
  {
    name: 'Steel Utility Trailers',
    slug: 'steel-utility-trailers',
    image: 'https://vanderleesttrailers.com/wp-content/uploads/2026/01/IMG_5289-scaled.jpeg',
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
    home: 'https://vanderleesttrailers.com/wp-content/uploads/2025/03/Hero-slide3.jpg',
    homeMobile: 'https://vanderleesttrailers.com/wp-content/uploads/2023/06/Vanderleest_Hero_Mobile.jpg',
    homeDesktop: 'https://vanderleesttrailers.com/wp-content/uploads/2023/06/Vanderleest_Hero.jpg',
    services: 'https://vanderleesttrailers.com/wp-content/uploads/2025/03/services_header-2.jpg',
    inventory: 'https://vanderleesttrailers.com/wp-content/uploads/2025/03/Inventory-header.jpg',
    financing: 'https://vanderleesttrailers.com/wp-content/uploads/2025/03/financing_header.jpg',
    contact: 'https://vanderleesttrailers.com/wp-content/uploads/2025/03/contact_header-1.jpg',
    faq: 'https://vanderleesttrailers.com/wp-content/uploads/2025/03/faq-photo.jpg',
  },
  serviceIcons: {
    welding: 'https://vanderleesttrailers.com/wp-content/uploads/2025/03/Icons_welding-1.png',
    painting: 'https://vanderleesttrailers.com/wp-content/uploads/2025/03/Icons_painting-1.png',
    electrical: 'https://vanderleesttrailers.com/wp-content/uploads/2025/03/Icons_electrical-1.png',
    brakes: 'https://vanderleesttrailers.com/wp-content/uploads/2025/03/Icons_brakes-1.png',
    custom: 'https://vanderleesttrailers.com/wp-content/uploads/2025/03/Custom.png',
  },
  logos: {
    main: 'https://vanderleesttrailers.com/wp-content/uploads/2024/02/VanderLeest-logo-FINAL-2-2.png',
    header: 'https://vanderleesttrailers.com/wp-content/uploads/2024/02/VanderLeest-logo-FINAL-2-2.png',
    headerAlt: 'https://vanderleesttrailers.com/wp-content/uploads/2024/02/VanderLeest-Logo-Header.png',
    footer: 'https://vanderleesttrailers.com/wp-content/uploads/2023/06/Vanderleest_TSF_logo_footer.png',
    maxxd: 'https://vanderleesttrailers.com/wp-content/uploads/2025/10/maxx-d-trailer-logo.png',
    clicklease: 'https://vanderleesttrailers.com/wp-content/uploads/2025/03/click-lease-logo.png',
  },
  founder: 'https://vanderleesttrailers.com/wp-content/uploads/2025/03/Matt-Grandfather.jpg',
  reviews: [
    'https://vanderleesttrailers.com/wp-content/uploads/wprevslider/review-images/review-image-69700e4c52b96-0.jpg',
    'https://vanderleesttrailers.com/wp-content/uploads/wprevslider/review-images/review-image-69700e4c80db4-0.jpg',
    'https://vanderleesttrailers.com/wp-content/uploads/wprevslider/review-images/review-image-69700e4ca36a6-0.jpg',
  ],
};
