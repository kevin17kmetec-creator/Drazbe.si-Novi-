import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import AuctionView from './src/components/AuctionView';
import SellerView from './src/components/SellerView';
import { 
  Search, User, Globe, ChevronLeft, ChevronRight, Clock, MapPin, TrendingUp, Gavel,
  ArrowLeft, ChevronDown, ShieldCheck, Building2, Eye,
  Plus, Minus, Lock, CheckCircle2, Mail, Phone, CreditCard as CardIcon, PlusCircle, 
  Settings, LogOut, Star, Camera, Landmark, FileCheck, AlertCircle, X, Calendar, 
  UserCheck, MessageSquare, History, Briefcase, Upload, Image as ImageIcon, ArrowUp,
  Trophy, AlertTriangle, Info, Table, Truck, Zap, Download, CreditCard, AlertOctagon,
  Trash2, Filter, LayoutGrid, List, Scale, FileText, HelpCircle, Languages, FileUp
} from 'lucide-react';

import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';

import { MOCK_SELLERS, MOCK_AUCTIONS } from './data.ts';
import { supabase } from './src/lib/supabaseClient';

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY || 'pk_test_TYooMQauvdEDq54NiTphI7jx');
import { AuctionItem, Region, ViewState, Seller, Review, SellerType, SubscriptionTier, PaymentCard, WonItem, Category } from './types.ts';

// --- CONFIGURATION ---
const IS_LIVE = false; 

// --- IMPROVED MOCK DATA ---
const EXTENDED_MOCK_AUCTIONS: AuctionItem[] = MOCK_AUCTIONS.map(a => ({
  ...a,
  images: [
    a.images[0],
    'https://images.unsplash.com/photo-1581092160562-40aa08e78837?auto=format&fit=crop&q=80&w=800',
    'https://images.unsplash.com/photo-1504917595217-d4dc5ebe6122?auto=format&fit=crop&q=80&w=800'
  ]
}));

const generateMockData = () => {
    const regions = Object.values(Region);
    for (let i = 0; i < 120; i++) {
        const baseItem = MOCK_AUCTIONS[i % MOCK_AUCTIONS.length];
        const randomTimeOffset = Math.floor(Math.random() * 1000 * 60 * 60 * 24 * 3); 
        const randomPrice = Math.floor(Math.random() * 5000) + 100;
        EXTENDED_MOCK_AUCTIONS.push({
            ...baseItem,
            id: `mock-gen-${i}`,
            title: {
                SLO: `${baseItem.title.SLO} (Kopija ${i+1})`,
                EN: `${baseItem.title.EN} (Copy ${i+1})`,
                DE: `${baseItem.title.DE} (Kopie ${i+1})`
            },
            currentBid: randomPrice,
            endTime: new Date(Date.now() + randomTimeOffset),
            region: regions[Math.floor(Math.random() * regions.length)],
            bidCount: Math.floor(Math.random() * 50),
            images: [
                `https://images.unsplash.com/photo-${1500000000000 + i}?auto=format&fit=crop&q=80&w=800`,
                `https://images.unsplash.com/photo-${1510000000000 + i}?auto=format&fit=crop&q=80&w=800`,
                `https://images.unsplash.com/photo-${1520000000000 + i}?auto=format&fit=crop&q=80&w=800`
            ]
        });
    }
};
generateMockData();

// --- LOKALIZACIJA ---
const translations: Record<string, any> = {
  SLO: {
    top10: "TOP 10 DRAŽB DNEVA",
    allAuctions: "VSE DRAŽBE",
    regions: "REGIJE",
    lastChance: "ZADNJA PRILOŽNOST",
    lastChanceTitle: "ZADNJA PRILOŽNOST",
    myProfile: "MOJ PROFIL",
    login: "PRIJAVA",
    searchPlaceholder: "Išči po lokaciji ali nazivu...",
    currentBid: "Trenutna cena",
    timeLeft: "Preostali čas",
    bidCount: "Ponudbe",
    placeBid: "POTRDI",
    aboutAuction: "O dražbi",
    saveChanges: "SHRANI SPREMEMBE",
    activeAuctions: "AKTUALNE DRAŽBE",
    trending: "Aktualno",
    location: "Lokacija",
    openAuction: "ODPRI DRAŽBO",
    footerDesc: "Prva slovenska platforma za profesionalne dražbe, vozila in opremo.",
    help: "POMOČ",
    terms: "Splošni pogoji",
    privacy: "Varovanje podatkov",
    howItWorks: "Kako deluje?",
    contact: "KONTAKT",
    rights: "Vse pravice pridržane | Drazba.si",
    verifyNotice: "Profil ni verificiran. Za oddajo ponudb je potrebna verifikacija identitete (18. člen SP).",
    verifyAction: "VERIFICIRAJ ZDAJ",
    backToAuctions: "Nazaj na dražbe",
    createAuction: "USTVARI DRAŽBO",
    publishAuction: "OBJAVI DRAŽBO",
    cancel: "PREKLIČI",
    itemsPerPage: "Prikaži:",
    prev: "Nazaj",
    next: "Naprej",
    legalTerms: "Splošni pogoji uporabe",
    legalPrivacy: "Varstvo osebnih podatkov (GDPR)",
    legalHow: "Navodila za sodelovanje",
    individual: "Fizična oseba",
    business: "Podjetje",
    identityVerification: "Verifikacija identitete",
    verifiedStatus: "Profil uspešno verificiran",
    unverifiedStatus: "Profil še ni verificiran",
    langSelect: "Izbira jezika",
    settings: "Nastavitve",
    subscriptions: "Naročnine",
    firstName: "Ime",
    lastName: "Priimek",
    email: "E-pošta",
    password: "Geslo",
    profilePicture: "Profilna slika",
    freeTier: "Brezplačno",
    basicTier: "Osnovni",
    proTier: "Napredni",
    freeDesc: "Do 5 objav mesečno, 8% provizija",
    basicDesc: "Do 50 objav mesečno, 6.5% provizija",
    proDesc: "Neomejeno objav, 3% provizija",
    subscribe: "Naroči se",
    currentPlan: "Trenutni paket",
    paymentMethods: "Načini plačila",
    payWithCard: "Plačaj s kartico",
    payWithGoogle: "Google Pay",
    payWithApple: "Apple Pay",
    payWithPaypal: "PayPal",
    checkout: "Blagajna",
    totalAmount: "Skupni znesek",
    payNow: "Plačaj zdaj",
    paymentSuccess: "Plačilo uspešno!",
    sellerProfile: "Profil prodajalca",
    memberSince: "Član od",
    totalSold: "Skupaj prodano",
    positiveFeedback: "Pozitivne ocene",
    activeAuctionsTab: "Aktualne dražbe",
    pastAuctionsTab: "Pretekle dražbe",
    userReviewsTab: "Ocene uporabnikov",
    leaveReview: "Oddaj svojo oceno",
    reviewNotice: "Ker ste pri tem prodajalcu že kupovali, lahko oddate svojo izkušnjo.",
    rating: "Ocena",
    recommend: "Bi priporočali?",
    yesRecommend: "Da, priporočam",
    noRecommend: "Ne priporočam",
    comment: "Vaš komentar",
    commentPlaceholder: "Opišite svojo izkušnjo s prodajalcem...",
    publishReview: "Objavi oceno",
    reviewRestriction: "Oceno lahko oddajo le uporabniki, ki so pri tem prodajalcu že uspešno opravili nakup.",
    noActiveAuctions: "Trenutno ni aktivnih dražb.",
    noPastAuctions: "Ni preteklih dražb.",
    noReviews: "Prodajalec še nima ocen.",
    verifiedSeller: "Preverjeno",
    businessSeller: "Podjetje",
    individualSeller: "Zasebni prodajalec",
    back: "Nazaj",
    loading: "Nalagam",
    backToList: "Nazaj na seznam",
    info: "Informacije",
    information: "Informacije",
    description: "Opis",
    biddingPossible: "Oddaja ponudb možna",
    auctionEnded: "Dražba zaključena",
    closing: "Zaključek",
    unknown: "Neznano",
    viewing: "Ogled",
    byArrangement: "Po dogovoru s prodajalcem",
    pickup: "Prevzem",
    pickupLocation: "Prevzemna lokacija",
    region: "Regija",
    locationHiddenNotice: "Točna lokacija bo razkrita zmagovalcu po plačilu.",
    mapAvailable: "Zemljevid na voljo",
    mapHidden: "Zemljevid skrit",
    contactInfo: "Kontakt",
    team: "Ekipa",
    viewSeller: "Ogled prodajalca",
    winnerNotice: "Čestitamo, zmagali ste! Prosimo, dokončajte plačilo.",
    sellerWinnerNotice: "Zmagovalec je bil obveščen in preusmerjen na plačilo.",
    notWinnerNotice: "Dražba se je končala. Niste zmagovalec.",
    days: "DNI",
    hours: "URE",
    minutes: "MIN",
    seconds: "SEK",
    startingPrice: "Začetna cena",
    myMaxBid: "Moja max ponudba",
    placeBidBtn: "Ponudi",
    feesAndTerms: "Pristojbine in pogoji",
    auctionFee: "Dražbena provizija",
    percent: "Odstotkov",
    vat: "DDV",
    deliveryTerms: "Pogoji dostave",
    deliveryTermsNotice: "Osebni prevzem na lokaciji prodajalca. Pošiljanje ni mogoče, razen če je izrecno dogovorjeno.",
    paymentOptions: "Možnosti plačila",
    creditCard: "Kreditna kartica",
    ended: "Zaključeno",
    finalPrice: "Končna cena",
    seller: "Prodajalec",
    watch: "Opazuj",
    loadingImages: "Nalaganje slik...",
    bidSuccessMsg: "Ponudba uspešno oddana!",
    confirmBidTitle: "Potrditev ponudbe",
    yourBid: "Vaša ponudba:",
    bidTerms: "Z oddajo ponudbe se strinjate z našimi Splošnimi pogoji poslovanja in potrjujete, da je vaša ponudba pravno zavezujoča. V primeru zmage ste dolžni predmet plačati.",
    confirmBidBtn: "Potrdi ponudbo",
    uhr: "URA",
    bidFailed: "Ponudba ni uspela.",
    auctionFallback: "Dražba",
    noDescription: "Ni dodatnega opisa.",
    slovenia: "Slovenija",
    passwordsNotMatch: "Novi gesli se ne ujemata!",
    oldPasswordRequired: "Za spremembo gesla morate vnesti staro geslo.",
    auctionPublished: "Dražba je bila uspešno objavljena z avtomatskimi prevodi!",
    enterAllData: "Vnesite vse podatke.",
    publishError: "Napaka pri objavi.",
    checkoutDesc: "Pregled in plačilo dobljenih dražb",
    finalAmount: "Končni znesek",
    paymentFor: "Plačilo za",
    show: "Prikaži",
    verificationRequired: "V skladu z 18. členom SP je za sodelovanje na dražbi obvezna verifikacija podatkov.",
    address: "Naslov prebivališča",
    emso: "EMŠO",
    taxNumber: "Davčna številka",
    companyAddress: "Sedež podjetja",
    profileVerifiedAs: "Vaš profil je verificiran kot",
    accountTypeChangeNotPossible: "Sprememba tipa računa po verifikaciji ni več mogoča.",
    newAuction: "Nova dražba",
    auctionTitle: "Naslov dražbe",
    describeItem: "Podrobno opišite predmet...",
    processing: "Obdelava...",
    createAccount: "USTVARI RAČUN",
    noAccountRegister: "Še nimate računa? Registracija",
    haveAccountLogin: "Že imate račun? Prijava",
    success: "Uspešno!",
    enterTitle: "Vnesite naslov...",
    itemDescription: "Opis predmeta",
    startingPriceEur: "Izklicna cena (€)",
    itemImages: "Slike predmeta",
    uploadImages: "Naloži slike",
    publishAuctionBtn: "Objavi dražbo",
    dragImages: "Povlecite slike sem ali kliknite",
    supportedFormats: "Podpira: JPG, PNG (maks. 5MB na sliko)",
    showing: "Prikazujem",
    of: "od",
    auctions: "dražb",
    auctionEndTime: "Zaključek dražbe",
    endDate: "Datum zaključka",
    endTime: "Ura zaključka",
    invalidEndTime: "Zaključek dražbe mora biti med 3 in 14 dni od danes, med 06:00 in 21:59.",
    categories: "KATEGORIJE",
    allCategories: "Vse kategorije",
    category: "Kategorija",
    cat_clothing: "Oblačila",
    cat_computers: "Računalniki",
    cat_leisure: "Prosti čas in šport",
    cat_home: "Dom in vrt",
    cat_auto: "Avtomobilizem",
    cat_realestate: "Nepremičnine",
    cat_health: "Lepota in zdravje",
    cat_kids: "Otroška oprema",
    cat_agriculture: "Kmetijstvo",
    cat_art: "Umetnine",
    cat_instruments: "Glasbila",
    cat_collecting: "Zbirateljstvo",
    cat_other: "Ostalo"
  },
  EN: {
    top10: "TOP 10 AUCTIONS OF THE DAY",
    allAuctions: "ALL AUCTIONS",
    regions: "REGIONS",
    lastChance: "LAST CHANCE",
    lastChanceTitle: "LAST CHANCE AUCTIONS",
    myProfile: "MY PROFILE",
    login: "LOGIN",
    searchPlaceholder: "Search by location or name...",
    currentBid: "Current price",
    timeLeft: "Time left",
    bidCount: "Bids",
    placeBid: "CONFIRM",
    aboutAuction: "About auction",
    saveChanges: "SAVE CHANGES",
    activeAuctions: "ACTIVE AUCTIONS",
    trending: "Trending",
    location: "Location",
    openAuction: "OPEN AUCTION",
    footerDesc: "The first Slovenian platform for professional auctions, vehicles and equipment.",
    help: "HELP",
    terms: "Terms & Conditions",
    privacy: "Data Privacy",
    howItWorks: "How it works?",
    contact: "CONTACT",
    rights: "All rights reserved | Drazba.si",
    verifyNotice: "Profile not verified. Identity verification is required for bidding (Art. 18 SP).",
    verifyAction: "VERIFY NOW",
    backToAuctions: "Back to auctions",
    createAuction: "CREATE AUCTION",
    publishAuction: "PUBLISH AUCTION",
    cancel: "CANCEL",
    itemsPerPage: "Show:",
    prev: "Prev",
    next: "Next",
    legalTerms: "General Terms of Use",
    legalPrivacy: "Data Protection (GDPR)",
    legalHow: "Participation Instructions",
    individual: "Individual",
    business: "Business",
    identityVerification: "Identity Verification",
    verifiedStatus: "Profile verified",
    unverifiedStatus: "Profile not verified",
    langSelect: "Language selection",
    settings: "Settings",
    subscriptions: "Subscriptions",
    firstName: "First Name",
    lastName: "Last Name",
    email: "Email",
    password: "Password",
    profilePicture: "Profile Picture",
    freeTier: "Free",
    basicTier: "Basic",
    proTier: "Pro",
    freeDesc: "Up to 5 posts/month, 8% fee",
    basicDesc: "Up to 50 posts/month, 6.5% fee",
    proDesc: "Unlimited posts, 3% fee",
    subscribe: "Subscribe",
    currentPlan: "Current Plan",
    paymentMethods: "Payment Methods",
    payWithCard: "Pay with Card",
    payWithGoogle: "Google Pay",
    payWithApple: "Apple Pay",
    payWithPaypal: "PayPal",
    checkout: "Checkout",
    totalAmount: "Total Amount",
    payNow: "Pay Now",
    paymentSuccess: "Payment Successful!",
    sellerProfile: "Seller Profile",
    memberSince: "Member Since",
    totalSold: "Total Sold",
    positiveFeedback: "Positive Feedback",
    activeAuctionsTab: "Active Auctions",
    pastAuctionsTab: "Past Auctions",
    userReviewsTab: "User Reviews",
    leaveReview: "Leave a Review",
    reviewNotice: "Since you have purchased from this seller before, you can share your experience.",
    rating: "Rating",
    recommend: "Would you recommend?",
    yesRecommend: "Yes, I recommend",
    noRecommend: "I don't recommend",
    comment: "Your comment",
    commentPlaceholder: "Describe your experience with the seller...",
    publishReview: "Publish Review",
    reviewRestriction: "Only users who have successfully completed a purchase from this seller can leave a review.",
    noActiveAuctions: "No active auctions at the moment.",
    noPastAuctions: "No past auctions.",
    noReviews: "Seller has no reviews yet.",
    verifiedSeller: "Verified",
    businessSeller: "Business",
    individualSeller: "Individual Seller",
    back: "Back",
    loading: "Loading",
    backToList: "Back to list",
    info: "Information",
    information: "Information",
    description: "Description",
    biddingPossible: "Bidding possible",
    auctionEnded: "Auction ended",
    closing: "Closing",
    unknown: "Unknown",
    viewing: "Viewing",
    byArrangement: "By arrangement with the seller",
    pickup: "Pickup",
    pickupLocation: "Pickup Location",
    region: "Region",
    locationHiddenNotice: "Exact location will be revealed to the winner after payment.",
    mapAvailable: "Map available",
    mapHidden: "Map hidden",
    contactInfo: "Contact",
    team: "Team",
    viewSeller: "View Seller",
    winnerNotice: "Congratulations, you won! Please complete the payment.",
    sellerWinnerNotice: "The winner has been notified and redirected to payment.",
    notWinnerNotice: "The auction has ended. You are not the winner.",
    days: "DAYS",
    hours: "HOURS",
    minutes: "MIN",
    seconds: "SEC",
    startingPrice: "Starting Price",
    myMaxBid: "My Max Bid",
    placeBidBtn: "Place Bid",
    feesAndTerms: "Fees and Terms",
    auctionFee: "Auction Fee",
    percent: "Percent",
    vat: "VAT",
    deliveryTerms: "Delivery Terms",
    deliveryTermsNotice: "Personal pickup at the seller's location. Shipping is not possible unless explicitly agreed upon.",
    paymentOptions: "Payment Options",
    creditCard: "Credit Card",
    ended: "Ended",
    finalPrice: "Final Price",
    seller: "Seller",
    watch: "Watch",
    loadingImages: "Loading images...",
    bidSuccessMsg: "Bid successfully placed!",
    confirmBidTitle: "Confirm Bid",
    yourBid: "Your bid:",
    bidTerms: "By placing a bid, you agree to our Terms and Conditions and confirm that your bid is legally binding. If you win, you are obligated to pay for the item.",
    confirmBidBtn: "Confirm Bid",
    uhr: "HRS",
    bidFailed: "Bid failed.",
    auctionFallback: "Auction",
    noDescription: "No additional description.",
    slovenia: "Slovenia",
    passwordsNotMatch: "New passwords do not match!",
    oldPasswordRequired: "You must enter your old password to change it.",
    auctionPublished: "Auction successfully published with automatic translations!",
    enterAllData: "Please enter all data.",
    publishError: "Error publishing.",
    checkoutDesc: "Review and pay for won auctions",
    finalAmount: "Final amount",
    paymentFor: "Payment for",
    show: "Show",
    verificationRequired: "According to Article 18 of the General Terms, data verification is required to participate in the auction.",
    address: "Residential Address",
    emso: "Personal ID Number (EMŠO)",
    taxNumber: "Tax Number",
    companyAddress: "Company Address",
    profileVerifiedAs: "Your profile is verified as",
    accountTypeChangeNotPossible: "Account type change is no longer possible after verification.",
    newAuction: "New Auction",
    auctionTitle: "Auction Title",
    describeItem: "Describe the item in detail...",
    processing: "Processing...",
    createAccount: "CREATE ACCOUNT",
    noAccountRegister: "Don't have an account? Register",
    haveAccountLogin: "Already have an account? Login",
    success: "Success!",
    enterTitle: "Enter title...",
    itemDescription: "Item Description",
    startingPriceEur: "Starting Price (€)",
    itemImages: "Item Images",
    uploadImages: "Upload Images",
    publishAuctionBtn: "Publish Auction",
    dragImages: "Drag images here or click",
    supportedFormats: "Supports: JPG, PNG (max 5MB per image)",
    showing: "Showing",
    of: "of",
    auctions: "auctions",
    auctionEndTime: "Auction End Time",
    endDate: "End Date",
    endTime: "End Time",
    invalidEndTime: "Auction end must be between 3 and 14 days from today, between 06:00 and 21:59.",
    categories: "CATEGORIES",
    allCategories: "All Categories",
    category: "Category",
    cat_clothing: "Clothing",
    cat_computers: "Computers",
    cat_leisure: "Leisure & Sport",
    cat_home: "Home & Garden",
    cat_auto: "Automotive",
    cat_realestate: "Real Estate",
    cat_health: "Health & Beauty",
    cat_kids: "Kids Equipment",
    cat_agriculture: "Agriculture",
    cat_art: "Art",
    cat_instruments: "Musical Instruments",
    cat_collecting: "Collecting",
    cat_other: "Other"
  },
  DE: {
    top10: "TOP 10 AUKTIONEN DES TAGES",
    allAuctions: "ALLE AUKTIONEN",
    regions: "REGIONEN",
    lastChance: "LETZTE CHANCE",
    lastChanceTitle: "LETZTE CHANCE AUKTIONEN",
    myProfile: "MEIN PROFIL",
    login: "ANMELDEN",
    searchPlaceholder: "Suche nach Ort oder Name...",
    currentBid: "Aktueller Preis",
    timeLeft: "Verbleibende Zeit",
    bidCount: "Gebote",
    placeBid: "BESTÄTIGEN",
    aboutAuction: "Über die Auktion",
    saveChanges: "ÄNDERUNGEN SPEICHERN",
    activeAuctions: "AKTIVE AUKTIONEN",
    trending: "Trend",
    location: "Standort",
    openAuction: "AUKTION ÖFFNEN",
    footerDesc: "Die erste slowenische Plattform für professionelle Auktionen, Fahrzeuge und Ausrüstung.",
    help: "HILFE",
    terms: "AGB",
    privacy: "Datenschutz",
    howItWorks: "Wie funktioniert es?",
    contact: "KONTAKT",
    rights: "Alle Rechte vorbehalten | Drazba.si",
    verifyNotice: "Profil nicht verifiziert. Identitätsprüfung für Gebote erforderlich (Art. 18 SP).",
    verifyAction: "JETZT VERIFIZIEREN",
    backToAuctions: "Zurück zu Auktionen",
    createAuction: "AUKTION ERSTELLEN",
    publishAuction: "AUKTION VERÖFFENTLICHEN",
    cancel: "ABBRECHEN",
    itemsPerPage: "Anzeigen:",
    prev: "Zurück",
    next: "Weiter",
    legalTerms: "Allgemeine Nutzungsbedingungen",
    legalPrivacy: "Datenschutz (DSGVO)",
    legalHow: "Teilnahmehinweise",
    individual: "Privatperson",
    business: "Unternehmen",
    identityVerification: "Identitätsprüfung",
    verifiedStatus: "Profil verifiziert",
    unverifiedStatus: "Profil nicht verifiziert",
    langSelect: "Sprachauswahl",
    settings: "Einstellungen",
    subscriptions: "Abonnements",
    firstName: "Vorname",
    lastName: "Nachname",
    email: "E-Mail",
    password: "Passwort",
    profilePicture: "Profilbild",
    freeTier: "Kostenlos",
    basicTier: "Basis",
    proTier: "Pro",
    freeDesc: "Bis zu 5 Beiträge/Monat, 8% Gebühr",
    basicDesc: "Bis zu 50 Beiträge/Monat, 6.5% Gebühr",
    proDesc: "Unbegrenzte Beiträge, 3% Gebühr",
    subscribe: "Abonnieren",
    currentPlan: "Aktueller Plan",
    paymentMethods: "Zahlungsmethoden",
    payWithCard: "Mit Karte zahlen",
    payWithGoogle: "Google Pay",
    payWithApple: "Apple Pay",
    payWithPaypal: "PayPal",
    checkout: "Kasse",
    totalAmount: "Gesamtbetrag",
    payNow: "Jetzt bezahlen",
    paymentSuccess: "Zahlung erfolgreich!",
    sellerProfile: "Verkäuferprofil",
    memberSince: "Mitglied seit",
    totalSold: "Insgesamt verkauft",
    positiveFeedback: "Positive Bewertungen",
    activeAuctionsTab: "Aktuelle Auktionen",
    pastAuctionsTab: "Vergangene Auktionen",
    userReviewsTab: "Nutzerbewertungen",
    leaveReview: "Bewertung abgeben",
    reviewNotice: "Da Sie bereits bei diesem Verkäufer gekauft haben, können Sie Ihre Erfahrung teilen.",
    rating: "Bewertung",
    recommend: "Würden Sie ihn weiterempfehlen?",
    yesRecommend: "Ja, ich empfehle ihn",
    noRecommend: "Ich empfehle ihn nicht",
    comment: "Ihr Kommentar",
    commentPlaceholder: "Beschreiben Sie Ihre Erfahrung mit dem Verkäufer...",
    publishReview: "Bewertung veröffentlichen",
    reviewRestriction: "Nur Nutzer, die bereits erfolgreich bei diesem Verkäufer eingekauft haben, können eine Bewertung abgeben.",
    noActiveAuctions: "Momentan keine aktiven Auktionen.",
    noPastAuctions: "Keine vergangenen Auktionen.",
    noReviews: "Der Verkäufer hat noch keine Bewertungen.",
    verifiedSeller: "Verifiziert",
    businessSeller: "Unternehmen",
    individualSeller: "Privatverkäufer",
    back: "Zurück",
    loading: "Laden",
    backToList: "Zurück zur Liste",
    info: "Informationen",
    information: "Informationen",
    description: "Beschreibung",
    biddingPossible: "Gebote möglich",
    auctionEnded: "Auktion beendet",
    closing: "Abschluss",
    unknown: "Unbekannt",
    viewing: "Besichtigung",
    byArrangement: "Nach Vereinbarung mit dem Verkäufer",
    pickup: "Abholung",
    pickupLocation: "Abholort",
    region: "Region",
    locationHiddenNotice: "Der genaue Standort wird dem Gewinner nach der Zahlung mitgeteilt.",
    mapAvailable: "Karte verfügbar",
    mapHidden: "Karte ausgeblendet",
    contactInfo: "Kontakt",
    team: "Team",
    viewSeller: "Verkäufer ansehen",
    winnerNotice: "Herzlichen Glückwunsch, Sie haben gewonnen! Bitte schließen Sie die Zahlung ab.",
    sellerWinnerNotice: "Der Gewinner wurde benachrichtigt und zur Zahlung weitergeleitet.",
    notWinnerNotice: "Die Auktion ist beendet. Sie sind nicht der Gewinner.",
    days: "TAGE",
    hours: "STUNDEN",
    minutes: "MIN",
    seconds: "SEK",
    startingPrice: "Startpreis",
    myMaxBid: "Mein Maximalgebot",
    placeBidBtn: "Gebot abgeben",
    feesAndTerms: "Gebühren und Bedingungen",
    auctionFee: "Auktionsgebühr",
    percent: "Prozent",
    vat: "MwSt.",
    deliveryTerms: "Lieferbedingungen",
    deliveryTermsNotice: "Persönliche Abholung am Standort des Verkäufers. Versand ist nicht möglich, es sei denn, es wurde ausdrücklich vereinbart.",
    paymentOptions: "Zahlungsmöglichkeiten",
    creditCard: "Kreditkarte",
    ended: "Beendet",
    finalPrice: "Endpreis",
    seller: "Verkäufer",
    watch: "Beobachten",
    loadingImages: "Bilder laden...",
    bidSuccessMsg: "Gebot erfolgreich abgegeben!",
    confirmBidTitle: "Gebot bestätigen",
    yourBid: "Ihr Gebot:",
    bidTerms: "Mit der Abgabe eines Gebots stimmen Sie unseren Allgemeinen Geschäftsbedingungen zu und bestätigen, dass Ihr Gebot rechtlich bindend ist. Im Falle eines Gewinns sind Sie verpflichtet, den Artikel zu bezahlen.",
    confirmBidBtn: "Gebot bestätigen",
    uhr: "UHR",
    bidFailed: "Gebot fehlgeschlagen.",
    auctionFallback: "Auktion",
    noDescription: "Keine zusätzliche Beschreibung.",
    slovenia: "Slowenien",
    passwordsNotMatch: "Neue Passwörter stimmen nicht überein!",
    oldPasswordRequired: "Sie müssen Ihr altes Passwort eingeben, um es zu ändern.",
    auctionPublished: "Auktion erfolgreich mit automatischen Übersetzungen veröffentlicht!",
    enterAllData: "Bitte geben Sie alle Daten ein.",
    publishError: "Fehler beim Veröffentlichen.",
    checkoutDesc: "Überprüfen und bezahlen Sie gewonnene Auktionen",
    finalAmount: "Endbetrag",
    paymentFor: "Zahlung für",
    show: "Anzeigen",
    verificationRequired: "Gemäß Artikel 18 der Allgemeinen Geschäftsbedingungen ist eine Datenüberprüfung erforderlich, um an der Auktion teilzunehmen.",
    address: "Wohnadresse",
    emso: "Persönliche Identifikationsnummer",
    taxNumber: "Steuernummer",
    companyAddress: "Firmenadresse",
    profileVerifiedAs: "Ihr Profil ist verifiziert als",
    accountTypeChangeNotPossible: "Eine Änderung des Kontotyps ist nach der Verifizierung nicht mehr möglich.",
    newAuction: "Neue Auktion",
    auctionTitle: "Auktionstitel",
    describeItem: "Beschreiben Sie den Artikel im Detail...",
    processing: "Verarbeitung...",
    createAccount: "KONTO ERSTELLEN",
    noAccountRegister: "Noch kein Konto? Registrieren",
    haveAccountLogin: "Bereits ein Konto? Anmelden",
    success: "Erfolgreich!",
    enterTitle: "Titel eingeben...",
    itemDescription: "Artikelbeschreibung",
    startingPriceEur: "Startpreis (€)",
    itemImages: "Artikelbilder",
    uploadImages: "Bilder hochladen",
    publishAuctionBtn: "Auktion veröffentlichen",
    dragImages: "Bilder hierher ziehen oder klicken",
    supportedFormats: "Unterstützt: JPG, PNG (max. 5MB pro Bild)",
    showing: "Zeige",
    of: "von",
    auctions: "Auktionen"
  }
};

const getIncrement = (amount: number) => {
  if (amount < 10) return 1;
  if (amount < 50) return 2;
  if (amount < 200) return 5;
  if (amount < 500) return 10;
  return 20;
};

const formatSeconds = (totalSeconds: number) => {
  if (totalSeconds <= 0) return "00:00";
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const mm = m.toString().padStart(2, '0');
  const ss = s.toString().padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
};

// --- COMPONENTS ---

const LegalModal: React.FC<{ type: 'terms' | 'privacy' | 'how'; onClose: () => void; t: any }> = ({ type, onClose, t }) => {
    const titles = { terms: t('legalTerms'), privacy: t('legalPrivacy'), how: t('legalHow') };
    const content = {
        terms: "Splošni pogoji poslovanja spletne platforme Drazba.si urejajo pravice in obveznosti ponudnikov in dražiteljev. Vsaka oddana ponudba je pravno zavezujoča po 18. členu Zakona o dražbah. Neplačilo v 24 urah po končani dražbi se obravnava kot kršitev pogodbe.",
        privacy: "Skladno z uredbo GDPR vaše podatke varujemo z najvišjimi varnostnimi standardi. Podatki se uporabljajo izključno za namene izvedbe dražb in verifikacije uporabnikov. Vaši podatki ne bodo posredovani tretjim osebam brez vaše privolitve.",
        how: "Za sodelovanje se registrirajte, opravite verifikacijo in oddajte svojo prvo ponudbo. Dražbe delujejo po sistemu 'videno-kupljeno'. Vsako prebitje ponudbe v zadnji minuti podaljša dražbo za dodatni 2 minuti."
    };

    return (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-[#0A1128]/95 backdrop-blur-md" onClick={onClose}></div>
            <div className="relative bg-white w-full max-w-2xl rounded-[3rem] p-10 lg:p-14 shadow-2xl animate-in border-4 border-[#FEBA4F]">
                <button onClick={onClose} className="absolute top-8 right-8 p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400"><X size={24} /></button>
                <h3 className="text-3xl font-black text-[#0A1128] uppercase tracking-tighter mb-8">{titles[type]}</h3>
                <div className="text-slate-600 font-bold leading-relaxed text-lg whitespace-pre-line mb-10">
                    {content[type]}
                </div>
                <button onClick={onClose} className="w-full bg-[#0A1128] text-white py-5 rounded-2xl font-black uppercase tracking-widest hover:bg-[#FEBA4F] hover:text-[#0A1128] transition-all shadow-xl">Razumem</button>
            </div>
        </div>
    );
};

const VerificationBanner: React.FC<{ onAction: () => void; t: any; isVisible: boolean }> = ({ onAction, t, isVisible }) => {
  if (!isVisible) return null;
  return (
    <div className="bg-[#FEBA4F] text-[#0A1128] fixed top-0 left-0 right-0 z-[2000] shadow-xl border-b border-black/10 h-12">
      <div className="max-w-[1600px] mx-auto flex h-full items-center justify-between gap-4 px-6">
        <div className="flex items-center gap-3">
          <AlertCircle size={18} className="flex-shrink-0 animate-pulse" />
          <p className="text-[11px] font-black uppercase tracking-tight leading-tight">
            {t('verifyNotice')}
          </p>
        </div>
        <div className="flex items-center">
          <button onClick={onAction} className="bg-[#0A1128] text-white px-5 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all flex-shrink-0 shadow-lg">
            {t('verifyAction')}
          </button>
        </div>
      </div>
    </div>
  );
};

const StaticTimer: React.FC<{ endTime: Date }> = ({ endTime }) => {
  const [timeLeftStr, setTimeLeftStr] = useState('');
  useEffect(() => {
    const update = () => {
      const diff = Math.max(0, Math.floor((endTime.getTime() - Date.now()) / 1000));
      setTimeLeftStr(formatSeconds(diff));
    };
    update(); const t = setInterval(update, 1000); return () => clearInterval(t);
  }, [endTime]);
  return (
    <div className="inline-flex items-center gap-2.5 px-4 py-2 rounded-2xl border-2 bg-[#FEBA4F]/10 border-[#FEBA4F]/30 text-[#FEBA4F] font-mono font-black text-2xl tabular-nums shadow-xl">
      <Clock size={20} /><span>{timeLeftStr}</span>
    </div>
  );
};

const AuctionCard: React.FC<{
  item: AuctionItem;
  t: any;
  language: string;
  isVerified: boolean;
  isWatched: boolean;
  onWatchToggle: () => void;
  onClick: () => void;
  onBidSubmit: (item: AuctionItem, amount: number) => void;
  onSellerClick: (seller: Seller) => void;
}> = ({ item, t, language, isVerified, isWatched, onWatchToggle, onClick, onBidSubmit, onSellerClick }) => {
  const [timeLeftStr, setTimeLeftStr] = useState('');
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [signedImages, setSignedImages] = useState<string[]>([]);
  const seller = MOCK_SELLERS.find(s => s.id === item.sellerId);
  const minNextBid = item.currentBid + getIncrement(item.currentBid);
  const [bidValue, setBidValue] = useState(minNextBid);

  useEffect(() => {
    const fetchImages = async () => {
      if (!item?.images) return;
      const urls = await Promise.all(item.images.map(async (imgPath: string) => {
        if (imgPath.startsWith('http')) return imgPath;
        const { data } = await supabase.storage.from('auction-images').createSignedUrl(imgPath, 3600);
        return data?.signedUrl || imgPath;
      }));
      setSignedImages(urls);
    };
    fetchImages();
  }, [item?.images]);

  useEffect(() => { setBidValue(item.currentBid + getIncrement(item.currentBid)); }, [item.currentBid]);
  useEffect(() => {
    const update = () => {
      const diff = Math.max(0, Math.floor((item.endTime.getTime() - Date.now()) / 1000));
      setTimeLeftStr(formatSeconds(diff));
    };
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [item.endTime]);

  const handleAdjustBid = (dir: 'up' | 'down') => {
    const step = getIncrement(bidValue);
    setBidValue(prev => dir === 'up' ? prev + step : Math.max(minNextBid, prev - step));
  };

  return (
    <div className="bg-[#0A1128] rounded-[2.5rem] overflow-hidden shadow-2xl hover:shadow-2xl hover:-translate-y-2 transition-all duration-300 group flex flex-col h-full border border-white/5 relative">
      <div className="relative h-64 overflow-hidden cursor-pointer group/image" onClick={onClick}>
        <img src={signedImages[currentImageIndex] || item.images[currentImageIndex]} alt={item.title[language] || item.title['SLO']} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 opacity-90 group-hover:opacity-100" />
        {(signedImages.length > 1 || item.images.length > 1) && (
          <>
            <button 
              onClick={(e) => { e.stopPropagation(); setCurrentImageIndex((prev) => (prev - 1 + (signedImages.length || item.images.length)) % (signedImages.length || item.images.length)); }}
              className="absolute left-2 top-1/2 -translate-y-1/2 p-1 bg-white/30 hover:bg-white/60 rounded-full opacity-0 group-hover/image:opacity-100 transition-opacity"
            >
                <ChevronLeft size={16} className="text-white" />
            </button>
            <button 
              onClick={(e) => { e.stopPropagation(); setCurrentImageIndex((prev) => (prev + 1) % (signedImages.length || item.images.length)); }}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 bg-white/30 hover:bg-white/60 rounded-full opacity-0 group-hover/image:opacity-100 transition-opacity"
            >
                <ChevronRight size={16} className="text-white" />
            </button>
          </>
        )}
        <div className="absolute top-4 left-4 bg-[#0A1128]/90 backdrop-blur-sm px-4 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest text-white shadow-lg flex items-center gap-1.5 border border-white/10">
          <MapPin size={10} className="text-[#FEBA4F]" /> {item.location[language] || item.location['SLO']}
        </div>
        <div className="absolute top-4 right-4 flex flex-col items-end gap-2">
          <button 
            onClick={(e) => { e.stopPropagation(); onWatchToggle(); }}
            className={`p-2 rounded-xl backdrop-blur-sm shadow-lg border transition-all ${isWatched ? 'bg-[#FEBA4F] border-[#FEBA4F] text-[#0A1128]' : 'bg-[#0A1128]/90 border-white/10 text-white hover:bg-white/10'}`}
          >
            <Eye size={14} fill={isWatched ? 'currentColor' : 'none'} />
          </button>
          <div className="bg-[#FEBA4F] text-[#0A1128] backdrop-blur-sm px-4 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest shadow-lg">
            {item.region}
          </div>
          <div className="bg-white/10 text-white backdrop-blur-sm px-4 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest shadow-lg border border-white/10">
            {item.category}
          </div>
        </div>
      </div>
      <div className="p-8 flex flex-col flex-1">
        <div className="mb-3 flex justify-between items-center">
            {seller && (
                <button onClick={(e) => { e.stopPropagation(); onSellerClick(seller); }} className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-[#FEBA4F] transition-colors flex items-center gap-1.5">
                    <Building2 size={12} /> {seller.name[language] || seller.name['SLO']}
                </button>
            )}
        </div>
        <h3 className="text-lg font-black leading-tight text-white hover:text-[#FEBA4F] transition-colors line-clamp-2 cursor-pointer mb-4" onClick={onClick}>{item.title[language] || item.title['SLO']}</h3>
        <div className="flex items-center gap-3 mb-6">
          <div className="bg-white/5 p-2 rounded-lg text-[#FEBA4F] border border-white/10"><Clock size={14} /></div>
          <div className="text-[10px] font-black uppercase tracking-widest text-white">
            <span className="text-slate-400 block">{t('timeLeft')}</span>
            <span className="text-[#FEBA4F] tabular-nums text-sm">{timeLeftStr}</span>
          </div>
        </div>
        <div className="mt-auto pt-6 border-t border-white/10">
          <div className="flex justify-between items-end mb-6">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">{t('currentBid')}</p>
              <p className="text-2xl font-black text-[#FEBA4F]">€{item.currentBid.toLocaleString('sl-SI')}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">{t('bidCount')}</p>
              <p className="text-sm font-black text-[#FEBA4F]">{item.bidCount}</p>
            </div>
          </div>
          <div className="flex items-center justify-between gap-3 w-full">
             <div className="flex items-center bg-white/5 rounded-2xl border border-white/10 p-1 flex-1">
                <button onClick={() => handleAdjustBid('down')} className="w-8 h-10 flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition-all flex-shrink-0"><Minus size={14}/></button>
                <div className="flex-1 flex items-center justify-center px-1">
                    <span className="text-[#FEBA4F] font-black text-xl mr-1">€</span>
                    <input type="text" value={bidValue} readOnly className="w-20 bg-transparent text-center text-white font-black text-2xl outline-none tabular-nums" />
                </div>
                <button onClick={() => handleAdjustBid('up')} className="w-8 h-10 flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition-all flex-shrink-0"><Plus size={14}/></button>
             </div>
             <button onClick={() => onBidSubmit(item, bidValue)} className={`h-12 px-5 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all shadow-lg flex items-center justify-center whitespace-nowrap ${isVerified ? 'bg-[#FEBA4F] text-[#0A1128] hover:bg-white' : 'bg-slate-800 text-slate-500'}`}>
                {!isVerified ? <Lock size={14} /> : t('placeBid')}
             </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const HeroCarousel: React.FC<{ items: AuctionItem[]; onSelectItem: (item: AuctionItem) => void; t: any; language: string }> = ({ items, onSelectItem, t, language }) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const featuredItems = useMemo(() => items.filter(a => a.status === 'active').slice(0, 10), [items]);
  
  const next = useCallback(() => setActiveIndex((prev) => (prev + 1) % featuredItems.length), [featuredItems.length]);
  const prev = useCallback(() => setActiveIndex((prev) => (prev - 1 + featuredItems.length) % featuredItems.length), [featuredItems.length]);

  useEffect(() => { 
    const timer = setInterval(next, 8000); 
    return () => clearInterval(timer); 
  }, [next, activeIndex]);

  if (featuredItems.length === 0) return null;

  return (
    <div className="relative w-full h-[600px] mb-8 overflow-hidden bg-[#0A1128] group">
      <div className="absolute top-16 left-0 right-0 flex justify-center z-20 pointer-events-none">
        <div className="bg-[#FEBA4F] text-[#0A1128] px-6 py-2 rounded-full font-black uppercase text-[10px] tracking-widest animate-bounce shadow-lg">
          {t('trending')}
        </div>
      </div>

      <div 
        className="flex h-full transition-transform duration-700 ease-in-out" 
        style={{ transform: `translateX(-${activeIndex * 100}%)` }}
      >
        {featuredItems.map((item) => (
          <div key={item.id} className="min-w-full h-full relative flex-shrink-0">
            <img 
              src={item.images[0]} 
              className="absolute inset-0 w-full h-full object-cover opacity-40" 
              alt={item.title[language] || item.title['SLO']}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0A1128] via-transparent to-transparent"></div>
            
            <div className="absolute inset-0 flex flex-col justify-center items-center text-center p-6 text-white max-w-4xl mx-auto z-10 pt-16">
              <h2 className="text-5xl lg:text-7xl font-black mb-8 tracking-tighter uppercase italic">
                {item.title[language] || item.title['SLO']}
              </h2>
              <div className="flex items-center gap-12 mb-12">
                <div>
                  <p className="text-[10px] font-black uppercase text-slate-400 mb-1">{t('currentBid')}</p>
                  <p className="text-5xl font-black text-[#FEBA4F]">€{item.currentBid.toLocaleString('sl-SI')}</p>
                </div>
                <StaticTimer endTime={item.endTime} />
              </div>
              <button 
                onClick={() => onSelectItem(item)} 
                className="bg-white text-[#0A1128] px-16 py-6 rounded-[2rem] font-black uppercase tracking-widest hover:bg-[#FEBA4F] transition-all shadow-2xl"
              >
                {t('openAuction')}
              </button>
            </div>
          </div>
        ))}
      </div>
      
      <button 
        onClick={prev} 
        className="absolute left-8 top-1/2 -translate-y-1/2 z-20 text-[#FEBA4F] opacity-0 group-hover:opacity-100 transition-opacity duration-300"
      >
        <ChevronLeft size={64} strokeWidth={2.5} />
      </button>
      <button 
        onClick={next} 
        className="absolute right-8 top-1/2 -translate-y-1/2 z-20 text-[#FEBA4F] opacity-0 group-hover:opacity-100 transition-opacity duration-300"
      >
        <ChevronRight size={64} strokeWidth={2.5} />
      </button>

      <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex gap-3 z-10">
          {featuredItems.map((_, i) => (
              <button 
                key={i} 
                onClick={() => setActiveIndex(i)} 
                className={`h-1 rounded-full transition-all ${i === activeIndex ? 'w-12 bg-[#FEBA4F]' : 'w-4 bg-white/20 hover:bg-white/40'}`}
              ></button>
          ))}
      </div>
    </div>
  );
};

const Header: React.FC<{ 
  onHome: () => void;
  onSearch: (val: string) => void;
  onRegionSelect: (reg: Region | null) => void;
  onCategorySelect: (cat: Category | null) => void;
  onLastChance: () => void;
  onLogin: () => void;
  onLogout: () => void;
  onSettings: () => void;
  onSubscriptions: () => void;
  onCreateAuction: () => void;
  onMyWinnings: () => void;
  onWatchlist: () => void;
  activeView: ViewState;
  selectedRegion: Region | null;
  selectedCategory: Category | null;
  isLoggedIn: boolean;
  isVerified: boolean;
  language: string;
  onLanguageChange: (l: string) => void;
  t: (k: string) => string;
  auctions: AuctionItem[];
}> = ({ onHome, onSearch, onRegionSelect, onCategorySelect, onLastChance, onLogin, onLogout, onSettings, onSubscriptions, onCreateAuction, onMyWinnings, onWatchlist, activeView, selectedRegion, selectedCategory, isLoggedIn, isVerified, language, onLanguageChange, t, auctions }) => {
  const [isRegOpen, setIsRegOpen] = useState(false);
  const [isCatOpen, setIsCatOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isLangOpen, setIsLangOpen] = useState(false);

  const languages = [
      { code: 'SLO', label: 'Slovenščina' },
      { code: 'EN', label: 'English' },
      { code: 'DE', label: 'Deutsch' }
  ];

  const regionCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    Object.values(Region).forEach(r => counts[r] = 0);
    auctions.filter(a => a.status === 'active').forEach(a => {
      if (counts[a.region] !== undefined) counts[a.region]++;
    });
    return counts;
  }, [auctions]);

  // Simplified Slovenia Map Paths (stylized)
  const sloMapRegions = [
    { id: Region.Stajerska, path: "M 140,40 L 180,20 L 220,40 L 240,80 L 200,100 L 160,90 Z", labelPos: { x: 190, y: 60 } },
    { id: Region.Gorenjska, path: "M 40,40 L 100,20 L 140,40 L 130,80 L 80,90 L 40,70 Z", labelPos: { x: 90, y: 50 } },
    { id: Region.Primorska, path: "M 20,80 L 60,100 L 50,140 L 10,150 L 5,110 Z", labelPos: { x: 30, y: 115 } },
    { id: Region.Dolenjska, path: "M 120,110 L 170,100 L 210,130 L 190,170 L 130,160 Z", labelPos: { x: 165, y: 135 } },
    { id: Region.Prekmurje, path: "M 220,40 L 260,10 L 290,30 L 280,60 L 240,80 Z", labelPos: { x: 255, y: 45 } },
    { id: Region.Koroska, path: "M 100,20 L 150,10 L 170,30 L 140,40 L 110,35 Z", labelPos: { x: 130, y: 25 } },
    { id: Region.Notranjska, path: "M 60,100 L 120,110 L 130,160 L 80,170 L 50,140 Z", labelPos: { x: 90, y: 135 } },
    { id: Region.Osrednjeslovenska, path: "M 80,90 L 130,80 L 170,100 L 120,110 L 60,100 Z", labelPos: { x: 115, y: 95 } },
  ];

  return (
    <header className="bg-[#0A1128] text-white shadow-2xl border-b border-white/10 sticky top-0 md:relative z-[500]">
      <div className="max-w-[1600px] mx-auto px-6 h-28 flex items-center justify-between">
            <div onClick={onHome} className="flex items-center cursor-pointer group">
              <img 
                src="https://lh3.googleusercontent.com/u/0/d/1yH_IHNJfoWXgrlrwESprp3gi29_MoYwi" 
                alt="Drazba.si Logo" 
                className="h-16 md:h-20 object-contain group-hover:scale-105 transition-transform" 
              />
            </div>
            <div className="hidden md:flex flex-1 max-w-xl mx-8 relative">
              <input type="text" placeholder={t('searchPlaceholder')} className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 pl-5 pr-12 text-sm focus:ring-2 focus:ring-[#FEBA4F] outline-none placeholder-slate-500 font-bold" onChange={(e) => onSearch(e.target.value)} />
              <Search className="absolute right-4 top-3.5 text-slate-500" size={18} />
            </div>
            <div className="flex items-center gap-4">
              <div className="relative h-full flex items-center"
                   onMouseEnter={() => setIsLangOpen(true)}
                   onMouseLeave={() => setIsLangOpen(false)}>
                  <button className="bg-white/5 px-4 py-2.5 rounded-xl border border-white/10 hover:bg-white/10 transition-all font-black text-xs flex items-center gap-2">
                    <Globe size={14} /> {language} <ChevronDown size={12} />
                  </button>
                  {isLangOpen && (
                      <div className="absolute top-full right-0 w-44 bg-[#0A1128] border border-white/10 rounded-b-2xl shadow-2xl py-3 z-[1000] animate-in">
                        {languages.map(l => (
                            <button key={l.code} onClick={() => { onLanguageChange(l.code); setIsLangOpen(false); }} className={`w-full text-left px-6 py-3 text-[10px] font-black tracking-widest transition-all ${language === l.code ? 'text-[#FEBA4F] bg-white/5' : 'text-slate-300 hover:text-white'}`}>
                                {l.label}
                            </button>
                        ))}
                      </div>
                  )}
              </div>

              {isLoggedIn ? (
                <div className="relative">
                  <button 
                    onClick={() => setIsUserMenuOpen(!isUserMenuOpen)} 
                    className="flex items-center gap-3 bg-white text-[#0A1128] px-6 py-2.5 rounded-2xl font-black text-sm shadow-xl hover:bg-[#FEBA4F] transition-colors"
                  >
                    <User size={18} /><span>{t('myProfile')}</span>
                    <ChevronDown size={14} className={isUserMenuOpen ? 'rotate-180 transition-transform' : 'transition-transform'}/>
                  </button>
                  {isUserMenuOpen && (
                    <div className="absolute top-full right-0 mt-3 w-64 bg-white border border-slate-200 rounded-[2rem] shadow-2xl py-4 text-[#0A1128] overflow-hidden z-[100] animate-in">
                        <div className="px-6 py-4 border-b border-slate-100 mb-2">
                            <p className="text-[10px] font-black text-slate-400 uppercase">Prijavljen kot</p>
                            <p className="font-black text-xs truncate">Uporabnik Drazba.si</p>
                        </div>
                        <button onClick={() => { onCreateAuction(); setIsUserMenuOpen(false); }} className="w-full flex items-center gap-3 px-6 py-4 hover:bg-slate-50 transition-colors text-xs font-black uppercase tracking-widest"><PlusCircle size={18} /> Ustvari dražbo</button>
                        <button onClick={() => { onMyWinnings(); setIsUserMenuOpen(false); }} className="w-full flex items-center gap-3 px-6 py-4 hover:bg-slate-50 transition-colors text-xs font-black uppercase tracking-widest"><Trophy size={18} /> Moje zmage</button>
                        <button onClick={() => { onWatchlist(); setIsUserMenuOpen(false); }} className="w-full flex items-center gap-3 px-6 py-4 hover:bg-slate-50 transition-colors text-xs font-black uppercase tracking-widest"><Eye size={18} /> Opazovane dražbe</button>
                        <button onClick={() => { onSubscriptions(); setIsUserMenuOpen(false); }} className="w-full flex items-center gap-3 px-6 py-4 hover:bg-slate-50 transition-colors text-xs font-black uppercase tracking-widest"><CreditCard size={18} /> {t('subscriptions')}</button>
                        <button onClick={() => { onSettings(); setIsUserMenuOpen(false); }} className="w-full flex items-center gap-3 px-6 py-4 hover:bg-slate-50 transition-colors text-xs font-black uppercase tracking-widest"><Settings size={18} /> {t('settings')}</button>
                        <button onClick={() => { onLogout(); setIsUserMenuOpen(false); }} className="w-full flex items-center gap-3 px-6 py-4 hover:bg-red-50 text-red-600 transition-colors text-xs font-black uppercase tracking-widest border-t border-slate-100"><LogOut size={18} /> Odjava</button>
                    </div>
                  )}
                </div>
              ) : (
                <button onClick={onLogin} className="bg-[#FEBA4F] text-[#0A1128] px-8 py-2.5 rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-white transition-all shadow-xl">{t('login')}</button>
              )}
            </div>
      </div>
      <div className="max-w-[1600px] mx-auto px-6 h-12 flex items-center gap-10 text-[11px] font-black uppercase tracking-widest border-t border-white/5">
            <button onClick={onHome} className={`hover:text-[#FEBA4F] transition-colors ${activeView === 'grid' && !selectedRegion && !selectedCategory ? 'text-[#FEBA4F]' : ''}`}>{t('allAuctions')}</button>
            
            <div className="relative h-full flex items-center" 
                 onMouseEnter={() => setIsRegOpen(true)}
                 onMouseLeave={() => setIsRegOpen(false)}>
                <button className={`flex items-center gap-1.5 h-full hover:text-[#FEBA4F] transition-colors ${selectedRegion ? 'text-[#FEBA4F]' : ''}`}>{t('regions')} <ChevronDown size={12}/></button>
                {isRegOpen && (
                    <div className="absolute top-full left-0 w-[400px] bg-[#0A1128] border border-white/10 rounded-b-[2rem] shadow-2xl p-6 z-[1000] animate-in">
                        <div className="mb-4 flex justify-between items-center">
                          <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Zemljevid regij</p>
                          <button onClick={() => onRegionSelect(null)} className="text-[9px] text-[#FEBA4F] hover:underline">Počisti filter</button>
                        </div>
                        <svg viewBox="0 0 300 180" className="w-full h-auto drop-shadow-2xl">
                          {sloMapRegions.map(reg => (
                            <g key={reg.id} 
                               className="cursor-pointer group" 
                               onClick={() => { onRegionSelect(reg.id); setIsRegOpen(false); }}>
                              <path 
                                d={reg.path} 
                                className={`transition-all duration-300 stroke-white/20 stroke-1 ${selectedRegion === reg.id ? 'fill-[#FEBA4F]' : 'fill-white/5 group-hover:fill-white/10'}`}
                              />
                              <text 
                                x={reg.labelPos.x} 
                                y={reg.labelPos.y} 
                                className={`text-[6px] font-black uppercase pointer-events-none transition-colors ${selectedRegion === reg.id ? 'fill-[#0A1128]' : 'fill-white/40 group-hover:fill-white'}`}
                                textAnchor="middle"
                              >
                                {reg.id}
                              </text>
                              <text 
                                x={reg.labelPos.x} 
                                y={reg.labelPos.y + 8} 
                                className={`text-[8px] font-black pointer-events-none transition-colors ${selectedRegion === reg.id ? 'fill-[#0A1128]' : 'fill-[#FEBA4F]'}`}
                                textAnchor="middle"
                              >
                                {regionCounts[reg.id] || 0}
                              </text>
                            </g>
                          ))}
                        </svg>
                    </div>
                )}
            </div>

            <div className="relative h-full flex items-center" 
                 onMouseEnter={() => setIsCatOpen(true)}
                 onMouseLeave={() => setIsCatOpen(false)}>
                <button className={`flex items-center gap-1.5 h-full hover:text-[#FEBA4F] transition-colors ${selectedCategory ? 'text-[#FEBA4F]' : ''}`}>{t('categories')} <ChevronDown size={12}/></button>
                {isCatOpen && (
                    <div className="absolute top-full left-0 w-64 bg-[#0A1128] border border-white/10 rounded-b-2xl shadow-2xl py-3 z-[1000] animate-in grid grid-cols-1 max-h-[400px] overflow-y-auto">
                        <button onClick={() => { onCategorySelect(null); setIsCatOpen(false); }} className={`w-full text-left px-6 py-3 hover:bg-white/5 text-[10px] font-black tracking-widest transition-all ${!selectedCategory ? 'text-[#FEBA4F]' : 'text-slate-300'}`}>{t('allCategories')}</button>
                        {Object.values(Category).map(c => (
                            <button key={c} onClick={() => { onCategorySelect(c); setIsCatOpen(false); }} className={`w-full text-left px-6 py-3 hover:bg-white/5 text-[10px] font-black tracking-widest transition-all ${selectedCategory === c ? 'text-[#FEBA4F]' : 'text-slate-300 hover:text-white'}`}>{c}</button>
                        ))}
                    </div>
                )}
            </div>

            <button onClick={onLastChance} className={`ml-auto flex items-center gap-1.5 hover:text-[#FEBA4F] transition-colors text-[#FEBA4F] underline underline-offset-4`}>{t('lastChance')} <ChevronRight size={14}/></button>
      </div>
    </header>
  );
};

const Footer: React.FC<{ t: any; onLegal: (type: 'terms' | 'privacy' | 'how') => void }> = ({ t, onLegal }) => (
    <footer className="bg-[#0A1128] text-white pt-24 pb-12 border-t border-white/10">
        <div className="max-w-[1600px] mx-auto px-6 grid grid-cols-1 md:grid-cols-4 gap-16 mb-24">
            <div className="col-span-1 md:col-span-2">
                <div className="flex items-center mb-8 cursor-pointer group">
                  <img 
                    src="https://lh3.googleusercontent.com/u/0/d/1yH_IHNJfoWXgrlrwESprp3gi29_MoYwi" 
                    alt="Drazba.si Logo" 
                    className="h-20 md:h-24 object-contain" 
                  />
                </div>
                <p className="text-slate-400 font-bold max-w-md leading-relaxed mb-8">{t('footerDesc')}</p>
                <div className="flex gap-4">
                    {[Globe, MessageSquare, Camera].map((Icon, i) => (
                        <button key={i} className="bg-white/5 p-4 rounded-2xl hover:bg-[#FEBA4F] hover:text-[#0A1128] transition-all"><Icon size={20} /></button>
                    ))}
                </div>
            </div>
            <div>
                <h4 className="font-black uppercase tracking-widest text-xs mb-8 text-[#FEBA4F]">{t('help')}</h4>
                <ul className="space-y-4 text-sm font-bold text-slate-400">
                    <li onClick={() => onLegal('terms')} className="hover:text-white cursor-pointer transition-colors">{t('terms')}</li>
                    <li onClick={() => onLegal('privacy')} className="hover:text-white cursor-pointer transition-colors">{t('privacy')}</li>
                    <li onClick={() => onLegal('how')} className="hover:text-white cursor-pointer transition-colors">{t('howItWorks')}</li>
                </ul>
            </div>
            <div>
                <h4 className="font-black uppercase tracking-widest text-xs mb-8 text-[#FEBA4F]">{t('contact')}</h4>
                <ul className="space-y-4 text-sm font-bold text-slate-400">
                    <li className="flex items-center gap-3"><Mail size={16} /> info@drazba.si</li>
                    <li className="flex items-center gap-3"><Phone size={16} /> +386 1 234 5678</li>
                    <li className="flex items-center gap-3"><MapPin size={16} /> Slovenska cesta 1, Ljubljana</li>
                </ul>
            </div>
        </div>
        <div className="max-w-[1600px] mx-auto px-6 pt-12 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-6 text-center md:text-left">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">© {new Date().getFullYear()} {t('rights')}</p>
            <div className="flex gap-6 grayscale opacity-40">
                <CardIcon size={24} />
                <CreditCard size={24} />
                <ShieldCheck size={24} />
            </div>
        </div>
    </footer>
);

const CheckoutForm: React.FC<{ amount: number; title: string; t: any; onSuccess: () => void; onClose: () => void }> = ({ amount, title, t, onSuccess, onClose }) => {
  const stripe = useStripe();
  const elements = useElements();
  const [method, setMethod] = useState<'card' | 'google' | 'apple' | 'paypal'>('card');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setIsProcessing(true);
    setError(null);

    try {
      const res = await fetch('/api/create-payment-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount })
      });
      const { clientSecret, error: backendError } = await res.json();
      
      if (backendError) throw new Error(backendError);

      const cardElement = elements.getElement(CardElement);
      if (!cardElement) throw new Error("Card element not found");

      const { error: stripeError, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
        payment_method: {
          card: cardElement as any,
        }
      });

      if (stripeError) {
        throw new Error(stripeError.message);
      } else if (paymentIntent && paymentIntent.status === 'succeeded') {
        onSuccess();
      }
    } catch (err: any) {
      setError(err.message || "Payment failed");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <form onSubmit={handlePay} className="relative bg-white w-full max-w-lg rounded-[3rem] p-10 shadow-2xl animate-in border-4 border-[#FEBA4F]">
        <button type="button" onClick={onClose} className="absolute top-8 right-8 p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400"><X size={24} /></button>
        <h3 className="text-3xl font-black text-[#0A1128] uppercase tracking-tighter mb-2">{t('checkout')}</h3>
        <p className="text-slate-500 font-bold mb-8">{title}</p>
        
        <div className="bg-slate-50 rounded-2xl p-6 mb-8 border border-slate-100">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">{t('totalAmount')}</p>
          <p className="text-4xl font-black text-[#FEBA4F]">€{amount.toLocaleString('sl-SI')}</p>
        </div>

        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4">{t('paymentMethods')}</p>
        <div className="grid grid-cols-2 gap-3 mb-8">
          <button type="button" onClick={() => setMethod('card')} className={`flex items-center justify-center gap-2 p-4 rounded-2xl border-2 font-black text-xs uppercase tracking-widest transition-all ${method === 'card' ? 'border-[#FEBA4F] bg-[#FEBA4F]/10 text-[#0A1128]' : 'border-slate-100 text-slate-400 hover:border-slate-200'}`}>
            <CardIcon size={16} /> {t('payWithCard')}
          </button>
          <button type="button" onClick={() => setMethod('google')} className={`flex items-center justify-center gap-2 p-4 rounded-2xl border-2 font-black text-xs uppercase tracking-widest transition-all ${method === 'google' ? 'border-[#FEBA4F] bg-[#FEBA4F]/10 text-[#0A1128]' : 'border-slate-100 text-slate-400 hover:border-slate-200'}`}>
            Google Pay
          </button>
          <button type="button" onClick={() => setMethod('apple')} className={`flex items-center justify-center gap-2 p-4 rounded-2xl border-2 font-black text-xs uppercase tracking-widest transition-all ${method === 'apple' ? 'border-[#FEBA4F] bg-[#FEBA4F]/10 text-[#0A1128]' : 'border-slate-100 text-slate-400 hover:border-slate-200'}`}>
            Apple Pay
          </button>
          <button type="button" onClick={() => setMethod('paypal')} className={`flex items-center justify-center gap-2 p-4 rounded-2xl border-2 font-black text-xs uppercase tracking-widest transition-all ${method === 'paypal' ? 'border-[#FEBA4F] bg-[#FEBA4F]/10 text-[#0A1128]' : 'border-slate-100 text-slate-400 hover:border-slate-200'}`}>
            PayPal
          </button>
        </div>

        {method === 'card' && (
          <div className="mb-8 p-4 border border-slate-200 rounded-xl bg-slate-50">
            <CardElement options={{
              style: {
                base: {
                  fontSize: '16px',
                  color: '#0A1128',
                  '::placeholder': {
                    color: '#94a3b8',
                  },
                },
                invalid: {
                  color: '#ef4444',
                },
              },
            }} />
          </div>
        )}

        {error && <div className="mb-6 text-red-500 text-sm font-bold text-center">{error}</div>}

        <button type="submit" disabled={!stripe || isProcessing} className="w-full bg-[#0A1128] text-white py-5 rounded-2xl font-black uppercase tracking-widest hover:bg-[#FEBA4F] hover:text-[#0A1128] transition-all shadow-xl disabled:opacity-50 flex items-center justify-center gap-2">
          {isProcessing ? <Clock className="animate-spin" size={20} /> : <Lock size={20} />}
          {isProcessing ? '...' : t('payNow')}
        </button>
    </form>
  );
};

const CheckoutModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  amount: number;
  title: string;
  t: any;
  onSuccess: () => void;
}> = ({ isOpen, onClose, amount, title, t, onSuccess }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-[#0A1128]/95 backdrop-blur-md" onClick={onClose}></div>
      <Elements stripe={stripePromise}>
        <CheckoutForm amount={amount} title={title} t={t} onSuccess={onSuccess} onClose={onClose} />
      </Elements>
    </div>
  );
};

const SubscriptionsView: React.FC<{ t: any; currentPlan: SubscriptionTier; onSubscribe: (tier: SubscriptionTier) => void; isVerified: boolean }> = ({ t, currentPlan, onSubscribe, isVerified }) => {
  const plans = [
    { tier: SubscriptionTier.FREE, name: t('freeTier'), price: 0, desc: t('freeDesc'), color: 'bg-slate-100 text-slate-600' },
    { tier: SubscriptionTier.BASIC, name: t('basicTier'), price: 20, desc: t('basicDesc'), color: 'bg-[#FEBA4F] text-[#0A1128]' },
    { tier: SubscriptionTier.PRO, name: t('proTier'), price: 50, desc: t('proDesc'), color: 'bg-[#0A1128] text-white' }
  ];

  return (
    <div className="max-w-6xl mx-auto px-6 py-12">
      <h2 className="text-4xl font-black uppercase tracking-tighter text-[#0A1128] mb-12">{t('subscriptions')}</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {plans.map(plan => (
          <div key={plan.tier} className={`rounded-[3rem] p-10 flex flex-col ${plan.color} ${currentPlan === plan.tier ? 'ring-4 ring-offset-4 ring-[#FEBA4F]' : ''}`}>
            {currentPlan === plan.tier && <div className="text-[10px] font-black uppercase tracking-widest mb-4 opacity-80">{t('currentPlan')}</div>}
            <h3 className="text-3xl font-black uppercase tracking-tighter mb-2">{plan.name}</h3>
            <div className="text-5xl font-black mb-6">€{plan.price}<span className="text-lg opacity-60">/mo</span></div>
            <p className="font-bold opacity-80 mb-10 flex-1">{plan.desc}</p>
            <button 
              onClick={() => onSubscribe(plan.tier)}
              disabled={currentPlan === plan.tier || (!isVerified && plan.tier !== SubscriptionTier.FREE)}
              className={`w-full py-4 rounded-2xl font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${currentPlan === plan.tier ? 'bg-black/10 opacity-50 cursor-not-allowed' : (!isVerified && plan.tier !== SubscriptionTier.FREE ? 'bg-slate-200 text-slate-500 cursor-not-allowed' : 'bg-white text-[#0A1128] hover:scale-105 shadow-xl')}`}
            >
              {!isVerified && plan.tier !== SubscriptionTier.FREE ? <><Lock size={18} /> {t('verifyAction')}</> : (currentPlan === plan.tier ? t('currentPlan') : t('subscribe'))}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

const SettingsView: React.FC<{ t: any; user: any; onSave: (data: any) => void }> = ({ t, user, onSave }) => {
  const [formData, setFormData] = useState({
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
    email: user?.email || '',
    oldPassword: '',
    newPassword: '',
    confirmPassword: '',
    profilePicture: user?.profilePicture || ''
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData({ ...formData, profilePicture: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.newPassword && formData.newPassword !== formData.confirmPassword) {
      alert(t('passwordsNotMatch'));
      return;
    }
    if (formData.newPassword && !formData.oldPassword) {
      alert(t('oldPasswordRequired'));
      return;
    }
    onSave(formData);
  };

  return (
    <div className="max-w-3xl mx-auto px-6 py-12">
      <h2 className="text-4xl font-black uppercase tracking-tighter text-[#0A1128] mb-12">{t('settings')}</h2>
      <form onSubmit={handleSave} className="bg-white rounded-[3rem] p-10 shadow-2xl border border-slate-100">
        
        <div className="flex items-center gap-6 mb-10">
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileChange} 
            accept="image/*" 
            className="hidden" 
          />
          <div 
            onClick={() => fileInputRef.current?.click()}
            className="w-24 h-24 rounded-full bg-slate-100 border-4 border-white shadow-lg overflow-hidden flex items-center justify-center relative group cursor-pointer"
          >
            {formData.profilePicture ? (
              <img src={formData.profilePicture} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              <User size={40} className="text-slate-300" />
            )}
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <Camera className="text-white" size={24} />
            </div>
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">{t('profilePicture')}</p>
            <button type="button" onClick={() => fileInputRef.current?.click()} className="text-xs font-black uppercase tracking-widest text-[#FEBA4F] hover:text-[#0A1128] transition-colors">Spremeni sliko</button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">{t('firstName')}</label>
            <input type="text" value={formData.firstName} onChange={e => setFormData({...formData, firstName: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-bold outline-none focus:border-[#FEBA4F]" />
          </div>
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">{t('lastName')}</label>
            <input type="text" value={formData.lastName} onChange={e => setFormData({...formData, lastName: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-bold outline-none focus:border-[#FEBA4F]" />
          </div>
        </div>

        <div className="mb-6">
          <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">{t('email')}</label>
          <input type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-bold outline-none focus:border-[#FEBA4F]" />
        </div>

        <div className="mb-10 p-6 bg-slate-50 rounded-2xl border border-slate-100">
          <h3 className="text-sm font-black uppercase tracking-widest text-[#0A1128] mb-6">Sprememba gesla</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Staro geslo</label>
              <input type="password" placeholder="••••••••" value={formData.oldPassword} onChange={e => setFormData({...formData, oldPassword: e.target.value})} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 font-bold outline-none focus:border-[#FEBA4F]" />
            </div>
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Novo geslo</label>
              <input type="password" placeholder="••••••••" value={formData.newPassword} onChange={e => setFormData({...formData, newPassword: e.target.value})} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 font-bold outline-none focus:border-[#FEBA4F]" />
            </div>
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Potrdi novo geslo</label>
              <input type="password" placeholder="••••••••" value={formData.confirmPassword} onChange={e => setFormData({...formData, confirmPassword: e.target.value})} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 font-bold outline-none focus:border-[#FEBA4F]" />
            </div>
          </div>
        </div>

        <button type="submit" className="w-full bg-[#0A1128] text-white py-5 rounded-2xl font-black uppercase tracking-widest hover:bg-[#FEBA4F] hover:text-[#0A1128] transition-all shadow-xl">
          {t('saveChanges')}
        </button>
      </form>
    </div>
  );
};

// --- MAIN APP COMPONENT ---

const App: React.FC = () => {
  const [language, setLanguage] = useState('SLO');
  const t = (key: string) => translations[language]?.[key] || key;
  
  const [auctions, setAuctions] = useState<AuctionItem[]>(EXTENDED_MOCK_AUCTIONS);
  const [activeView, setActiveView] = useState<ViewState>('grid');
  const [selectedRegion, setSelectedRegion] = useState<Region | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [userType, setUserType] = useState<'individual' | 'business' | null>(null);
  const [watchedIds, setWatchedIds] = useState<string[]>(() => {
    const saved = localStorage.getItem('watchedAuctions');
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    localStorage.setItem('watchedAuctions', JSON.stringify(watchedIds));
  }, [watchedIds]);

  const toggleWatch = (id: string) => {
    setWatchedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };
  const [activeLegal, setActiveLegal] = useState<'terms' | 'privacy' | 'how' | null>(null);
  const [currentPlan, setCurrentPlan] = useState<SubscriptionTier>(SubscriptionTier.FREE);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [checkoutData, setCheckoutData] = useState<{ amount: number; title: string; onSuccess: () => void } | null>(null);
  const [userData, setUserData] = useState({ firstName: '', lastName: '', email: '', profilePicture: '' });
  
  const [selectedItem, setSelectedItem] = useState<AuctionItem | null>(null);
  const [selectedSeller, setSelectedSeller] = useState<Seller | null>(null);
  const [currentUserWinnings, setCurrentUserWinnings] = useState<AuctionItem[]>([]);

  // Pagination & Scroll
  const [baseItemsPerPage, setBaseItemsPerPage] = useState(12);
  const [cols, setCols] = useState(4);

  useEffect(() => {
    const updateCols = () => {
      if (window.innerWidth >= 1536) setCols(5);
      else if (window.innerWidth >= 1280) setCols(4);
      else if (window.innerWidth >= 1024) setCols(3);
      else if (window.innerWidth >= 640) setCols(2);
      else setCols(1);
    };
    updateCols();
    window.addEventListener('resize', updateCols);
    return () => window.removeEventListener('resize', updateCols);
  }, []);

  const itemsPerPage = Math.ceil(baseItemsPerPage / cols) * cols;
  const [currentPage, setCurrentPage] = useState(1);
  const [showBackToTop, setShowBackToTop] = useState(false);

  // Ref for the "Aktualne dražbe" section
  const auctionsSectionRef = useRef<HTMLDivElement>(null);

  const fetchAuctions = async () => {
      const { data, error } = await supabase.from('auctions').select('*');
      if (error) {
          console.error("Error fetching auctions:", error);
          return;
      }
      
      const supabaseData: AuctionItem[] = data.map(d => ({
          ...d,
          endTime: new Date(d.end_time || d.endTime),
          currentBid: d.current_price || d.currentBid,
          bidCount: d.bid_count || d.bidCount
      }));

      if (IS_LIVE) {
          setAuctions(supabaseData);
      } else {
          const merged = [...EXTENDED_MOCK_AUCTIONS];
          supabaseData.forEach(fd => {
              const idx = merged.findIndex(m => m.id === fd.id);
              if (idx > -1) merged[idx] = fd;
              else merged.push(fd);
          });
          setAuctions(merged);
      }
  };

  // Effect to reset page and scroll to top on ANY view/category change
  useEffect(() => {
    setCurrentPage(1);
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [activeView, selectedRegion, selectedCategory, searchQuery]);

  // Firestore Sync
  useEffect(() => {
    fetchAuctions();

    const fetchWinnings = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            setCurrentUserWinnings([]);
            return;
        }

        // Fetch auctions where the user is the winner (highest bidder and auction ended)
        // For simplicity in this mock-heavy app, we'll fetch auctions where winner_id matches
        const { data, error } = await supabase
            .from('auctions')
            .select('*')
            .eq('winner_id', user.id);

        if (error) {
            console.error("Error fetching winnings:", error);
            return;
        }

        const wonItems: AuctionItem[] = data.map(d => ({
            ...d,
            endTime: new Date(d.end_time || d.endTime),
            currentBid: d.current_price || d.currentBid,
            bidCount: d.bid_count || d.bidCount
        }));
        setCurrentUserWinnings(wonItems);
    };

    fetchWinnings();

    const channel = supabase.channel('public:auctions')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'auctions' }, () => {
        fetchAuctions();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  // Auth Sync
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
        if (session?.user) {
            setIsLoggedIn(true);
            supabase.from('users').select('*').eq('id', session.user.id).single().then(({ data }) => {
                if (data) {
                    setIsVerified(data.isVerified || data.is_verified);
                    setUserType(data.userType || data.user_type);
                }
            });
        }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
        if (session?.user) {
            setIsLoggedIn(true);
            const { data } = await supabase.from('users').select('*').eq('id', session.user.id).single();
            if (data) {
                setIsVerified(data.isVerified || data.is_verified);
                setUserType(data.userType || data.user_type);
            }
        } else {
            setIsLoggedIn(false);
            setIsVerified(false);
        }
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const handleScroll = () => setShowBackToTop(window.scrollY > 300);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleBidSubmit = async (item: AuctionItem, amount: number) => {
    if (!isLoggedIn) { setActiveView('login'); return; }
    if (!isVerified) { 
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return; 
    }
    
    // Check if item.id is a valid UUID before calling RPC
    const isUUID = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    
    if (isUUID(item.id)) {
        try {
            const { error } = await supabase.rpc('place_bid_transaction', {
                p_auction_id: item.id,
                p_amount: amount
            });
            if (error) {
                console.error("RPC Error:", error);
                throw new Error(error.message || "Napaka pri oddaji ponudbe");
            }
        } catch (error: any) { 
            console.error(error); 
            throw error;
        }
    } else {
        // Handle mock auctions locally
        setAuctions(prev => prev.map(a => a.id === item.id ? {...a, currentBid: amount, bidCount: a.bidCount + 1} : a));
    }
  };

  const handlePublish = async (itemData: any) => {
      try {
          const { data: { session } } = await supabase.auth.getSession();
          if (!session) {
              alert(t('loginRequired') || "Prosimo, prijavite se za objavo dražbe.");
              setActiveView('login');
              return;
          }

          const simulatedTitle = {
              SLO: itemData.title.SLO,
              EN: `[EN] ${itemData.title.SLO}`,
              DE: `[DE] ${itemData.title.SLO}`
          };
          const simulatedDescription = {
              SLO: itemData.description,
              EN: `[EN] ${itemData.description}`,
              DE: `[DE] ${itemData.description}`
          };

          const { error } = await supabase.from('auctions').insert({
              title: simulatedTitle,
              description: simulatedDescription,
              current_price: parseInt(itemData.startingPrice),
              bid_count: 0,
              item_count: 1,
              end_time: itemData.endTime || new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString(),
              location: { SLO: 'Ljubljana', EN: 'Ljubljana', DE: 'Ljubljana' },
              region: itemData.region || Region.Osrednjeslovenska,
              category: itemData.category || Category.Ostalo,
              condition: { SLO: 'Novo', EN: 'New', DE: 'Neu' },
              specifications: {},
              bidding_history: [],
              seller_id: session.user.id,
              status: 'active',
              images: itemData.images
          });

          if (error) {
              console.error("Publish Error:", error);
              alert(t('publishError') || "Napaka pri objavi.");
              return;
          }

          setActiveView('grid');
          alert(t('auctionPublished'));
          fetchAuctions(); // Refresh the list
      } catch (error) { 
          console.error(error); 
          alert(t('publishError') || "Napaka pri objavi.");
      }
  };

  const handleLogout = () => {
    supabase.auth.signOut();
    setIsLoggedIn(false);
    setIsVerified(false);
    setUserType(null);
    setUserData({ firstName: '', lastName: '', email: '', profilePicture: '' });
    setActiveView('grid');
  };

  const handleSubscribe = (tier: SubscriptionTier) => {
    const prices = { [SubscriptionTier.FREE]: 0, [SubscriptionTier.BASIC]: 20, [SubscriptionTier.PRO]: 50 };
    if (tier === SubscriptionTier.FREE) {
      setCurrentPlan(tier);
      alert(t('paymentSuccess'));
      return;
    }
    setCheckoutData({
      amount: prices[tier],
      title: `Naročnina - ${tier}`,
      onSuccess: () => {
        setCurrentPlan(tier);
        setIsCheckoutOpen(false);
        alert(t('paymentSuccess'));
      }
    });
    setIsCheckoutOpen(true);
  };

  const handleSaveSettings = (data: any) => {
    setUserData(data);
    alert(t('saveChanges') + ' - ' + t('success'));
  };

  const getFilteredAuctions = useMemo(() => {
      let filtered = [...auctions];
      if (activeView === 'lastChance') {
          filtered = filtered.filter(i => i.status === 'active').sort((a, b) => a.endTime.getTime() - b.endTime.getTime()).slice(0, 200);
      } else {
          filtered = filtered.filter(item => {
              if (selectedRegion && item.region !== selectedRegion) return false;
              if (selectedCategory && item.category !== selectedCategory) return false;
              if (searchQuery) {
                  const q = searchQuery.toLowerCase();
                  const titleMatch = (item.title[language] || item.title['SLO']).toLowerCase().includes(q);
                  const locationMatch = (item.location[language] || item.location['SLO']).toLowerCase().includes(q);
                  return titleMatch || locationMatch;
              }
              return true;
          });
      }
      return filtered;
  }, [auctions, activeView, selectedRegion, selectedCategory, searchQuery, language]);

  const totalPages = Math.ceil(getFilteredAuctions.length / itemsPerPage);
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentAuctions = getFilteredAuctions.slice(indexOfFirstItem, indexOfLastItem);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    const isHomePage = activeView === 'grid' && !selectedCategory && !searchQuery;
    
    if (isHomePage && auctionsSectionRef.current) {
        auctionsSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const paginationNumbers = useMemo(() => {
      if (totalPages <= 7) return Array.from({length: totalPages}, (_, i) => i + 1);
      if (currentPage <= 4) return [1, 2, 3, 4, 5, '...', totalPages];
      if (currentPage >= totalPages - 3) return [1, '...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
      return [1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages];
  }, [currentPage, totalPages]);

  let content;
  switch (activeView) {
    case 'login': 
        content = (
            <AuthView 
                t={t} 
                onLoginSuccess={() => {
                    setIsLoggedIn(true);
                    setActiveView('grid');
                    window.scrollTo({ top: 0, behavior: 'instant' });
                }} 
                setIsVerified={setIsVerified} 
                setAppLoggedIn={(val) => setIsLoggedIn(val)}
            />
        ); 
        break;
    case 'createAuction': content = <CreateAuctionForm onBack={() => setActiveView('grid')} t={t} onPublish={handlePublish} />; break;
    case 'sellerProfile':
      if (selectedSeller) content = <SellerView seller={selectedSeller} onBack={() => setActiveView('grid')} onAuctionClick={(item) => { setSelectedItem(item); setActiveView('detail'); }} t={t} language={language} isLoggedIn={isLoggedIn} currentUserWinnings={[]} />;
      else setActiveView('grid');
      break;
    case 'detail':
      if (selectedItem) content = (
        <DetailView 
          item={selectedItem} 
          t={t} 
          language={language} 
          isVerified={isVerified} 
          isWatched={watchedIds.includes(selectedItem.id)}
          onWatchToggle={() => toggleWatch(selectedItem.id)}
          currentPlan={currentPlan} 
          onBack={() => { setActiveView('grid'); setSelectedItem(null); }} 
          onBidSubmit={handleBidSubmit} 
          onCheckout={(item) => { 
            setCheckoutData({ 
              amount: item.currentBid || item.current_price, 
              title: item.title?.[language] || item.title?.['SLO'] || t('auctionFallback'), 
              onSuccess: () => { alert(t('paymentSuccess')); setIsCheckoutOpen(false); } 
            }); 
            setIsCheckoutOpen(true); 
          }} 
          onSellerClick={(seller) => {
            setSelectedSeller(seller);
            setActiveView('sellerProfile');
            window.scrollTo({ top: 0, behavior: 'instant' });
          }}
        />
      );
      else setActiveView('grid');
      break;
    case 'verification':
        content = (
            <VerificationView 
                onBack={() => setActiveView('grid')} 
                t={t} 
                isVerified={isVerified} 
                userType={userType}
                onVerify={(type, data) => {
                    setIsVerified(true);
                    setUserType(type);
                    setActiveView('grid');
                }}
            />
        );
        break;
    case 'settings':
        content = <SettingsView t={t} user={userData} onSave={handleSaveSettings} />;
        break;
    case 'subscriptions':
        content = <SubscriptionsView t={t} currentPlan={currentPlan} onSubscribe={handleSubscribe} isVerified={isVerified} />;
        break;
    case 'sellerProfile':
        if (selectedSeller) {
            content = (
                <SellerView 
                    seller={selectedSeller} 
                    onBack={() => setActiveView('grid')} 
                    onAuctionClick={(item) => {
                        setSelectedItem(item);
                        setActiveView('detail');
                    }}
                    t={t}
                    language={language}
                    isLoggedIn={isLoggedIn}
                    currentUserWinnings={currentUserWinnings}
                />
            );
        } else {
            setActiveView('grid');
        }
        break;
    case 'winnings':
        const mockWonItem = {
            id: 'mock-win-1',
            title: { SLO: 'Rolex Submariner', EN: 'Rolex Submariner', DE: 'Rolex Submariner' },
            currentBid: 8500,
            images: ['https://images.unsplash.com/photo-1523170335258-f5ed11844a49?auto=format&fit=crop&q=80'],
            paymentStatus: 'pending'
        };
        content = (
            <div className="max-w-[1600px] mx-auto py-16 px-6 animate-in">
                <button onClick={() => setActiveView('grid')} className="flex items-center gap-2 text-slate-400 mb-10 font-black uppercase text-[10px] tracking-widest hover:text-[#0A1128] transition-colors"><ArrowLeft size={16}/> Nazaj</button>
                <div className="bg-white rounded-[4rem] p-12 shadow-2xl border border-slate-100 min-h-[500px]">
                    <div className="flex items-center gap-6 mb-12">
                        <div className="bg-[#FEBA4F] p-4 rounded-3xl shadow-lg shadow-[#FEBA4F]/20">
                            <Trophy size={40} className="text-[#0A1128]" />
                        </div>
                        <div>
                            <h2 className="text-4xl font-black uppercase tracking-tighter text-[#0A1128]">Moje zmage</h2>
                            <p className="text-slate-400 font-bold mt-2">Pregled in plačilo dobljenih dražb</p>
                        </div>
                    </div>
                    
                    <div className="space-y-6">
                        <div className="flex flex-col md:flex-row items-center gap-8 p-6 rounded-[2.5rem] border-2 border-slate-100 hover:border-[#FEBA4F] transition-colors group">
                            <img src={mockWonItem.images[0]} alt="Item" className="w-32 h-32 rounded-3xl object-cover shadow-md group-hover:scale-105 transition-transform" />
                            <div className="flex-1 text-center md:text-left">
                                <h3 className="text-2xl font-black uppercase tracking-tighter text-[#0A1128] mb-2">{mockWonItem.title[language as keyof typeof mockWonItem.title] || mockWonItem.title.SLO}</h3>
                                <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 text-sm font-bold text-slate-400">
                                    <span className="flex items-center gap-1.5"><Gavel size={16}/> Končni znesek: <span className="text-[#0A1128] font-black">€{mockWonItem.currentBid.toLocaleString('sl-SI')}</span></span>
                                    <span className="flex items-center gap-1.5"><Clock size={16}/> Dobljeno: <span className="text-[#0A1128] font-black">Danes</span></span>
                                </div>
                            </div>
                            <div className="flex flex-col gap-3 w-full md:w-auto">
                                <button 
                                    onClick={() => {
                                        setCheckoutData({
                                            amount: mockWonItem.currentBid,
                                            title: `Plačilo za: ${mockWonItem.title.SLO}`,
                                            onSuccess: () => {
                                                setIsCheckoutOpen(false);
                                                alert(t('paymentSuccess'));
                                            }
                                        });
                                        setIsCheckoutOpen(true);
                                    }}
                                    className="bg-[#0A1128] text-white px-8 py-4 rounded-2xl font-black uppercase tracking-widest text-sm hover:bg-[#FEBA4F] hover:text-[#0A1128] transition-all shadow-xl flex items-center justify-center gap-2"
                                >
                                    <CardIcon size={18} /> Plačaj zdaj
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
        break;
    case 'watchlist':
        content = (
            <div className="max-w-[1600px] mx-auto py-16 px-6 animate-in">
                <button onClick={() => setActiveView('grid')} className="flex items-center gap-2 text-slate-400 mb-10 font-black uppercase text-[10px] tracking-widest hover:text-[#0A1128] transition-colors"><ArrowLeft size={16}/> Nazaj</button>
                <div className="bg-white rounded-[4rem] p-12 shadow-2xl border border-slate-100 min-h-[500px]">
                    <div className="flex items-center gap-6 mb-12">
                        <div className="bg-[#FEBA4F] p-4 rounded-3xl shadow-lg shadow-[#FEBA4F]/20">
                            <Eye size={40} className="text-[#0A1128]" />
                        </div>
                        <div>
                            <h2 className="text-4xl font-black uppercase tracking-tighter text-[#0A1128]">Opazovane dražbe</h2>
                            <p className="text-slate-400 font-bold mt-2">Dražbe, ki jih spremljate</p>
                        </div>
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-10">
                        {auctions.filter(a => watchedIds.includes(a.id)).map(item => (
                            <AuctionCard 
                                key={item.id} 
                                item={item} 
                                t={t} 
                                language={language} 
                                isVerified={isVerified} 
                                isWatched={true}
                                onWatchToggle={() => toggleWatch(item.id)}
                                onClick={() => { setSelectedItem(item); setActiveView('detail'); }} 
                                onBidSubmit={handleBidSubmit} 
                                onSellerClick={(seller) => { setSelectedSeller(seller); setActiveView('sellerProfile'); }} 
                            />
                        ))}
                        {auctions.filter(a => watchedIds.includes(a.id)).length === 0 && (
                            <div className="col-span-full py-20 text-center bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
                                <Eye size={48} className="mx-auto mb-4 text-slate-300" />
                                <p className="text-slate-500 font-black uppercase tracking-widest text-xs">Nimate opazovanih dražb</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
        break;
    default:
      content = (
        <div className="animate-in">
          {activeView === 'grid' && !selectedCategory && !searchQuery && (
              <HeroCarousel 
                  items={auctions} 
                  onSelectItem={(item) => { 
                      window.scrollTo({ top: 0, behavior: 'instant' }); 
                      setSelectedItem(item); 
                      setActiveView('detail'); 
                  }} 
                  t={t} 
                  language={language} 
              />
          )}
          <div className="max-w-[1600px] mx-auto px-6 py-12">
            <div ref={auctionsSectionRef} className="flex flex-col md:flex-row md:items-center justify-between gap-8 mb-12 scroll-mt-32">
                <div className="flex items-center gap-4">
                    <div className="bg-[#FEBA4F] w-2.5 h-10 rounded-full shadow-lg"></div>
                    <h2 className="text-3xl font-black text-[#0A1128] uppercase tracking-tighter italic">
                        {activeView === 'lastChance' ? t('lastChanceTitle') : (selectedRegion ? `${t('regions')}: ${selectedRegion}` : (selectedCategory ? `${t('category')}: ${selectedCategory}` : (searchQuery ? `Rezultati: "${searchQuery}"` : t('activeAuctions'))))}
                    </h2>
                </div>
                <div className="flex items-center gap-4">
                    <span className="text-[10px] font-black uppercase text-slate-400">{t('itemsPerPage')}</span>
                    <select 
                        className="bg-white border-2 border-slate-100 rounded-xl px-4 py-2.5 text-xs font-black shadow-sm outline-none focus:border-[#FEBA4F] transition-colors cursor-pointer" 
                        value={baseItemsPerPage} 
                        onChange={e => {
                            setBaseItemsPerPage(parseInt(e.target.value));
                            setCurrentPage(1);
                        }}
                    >
                        <option value="12">Prikaži ~12</option>
                        <option value="24">Prikaži ~24</option>
                        <option value="48">Prikaži ~48</option>
                        <option value="96">Prikaži ~96</option>
                    </select>
                </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-10">
              {(() => {
                const activeAuctions = currentAuctions.filter(item => new Date(item.endTime) > new Date());
                
                return (
                    <>
                        {activeAuctions.map(item => (
                            <AuctionCard 
                                key={item.id} 
                                item={item} 
                                t={t} 
                                language={language} 
                                isVerified={isVerified} 
                                isWatched={watchedIds.includes(item.id)}
                                onWatchToggle={() => toggleWatch(item.id)}
                                onClick={() => { 
                                    window.scrollTo({ top: 0, behavior: 'instant' });
                                    setSelectedItem(item); 
                                    setActiveView('detail'); 
                                }} 
                                onBidSubmit={handleBidSubmit} 
                                onSellerClick={(seller) => { 
                                    setSelectedSeller(seller); 
                                    setActiveView('sellerProfile'); 
                                    window.scrollTo({ top: 0, behavior: 'instant' });
                                }} 
                            />
                        ))}
                    </>
                );
              })()}
            </div>
            {totalPages > 1 && (
                <div className="mt-20 flex flex-col md:flex-row items-center justify-between gap-8 border-t-2 border-slate-100 pt-12">
                    <div className="flex flex-col gap-2">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{t('showing')} {indexOfFirstItem + 1} - {Math.min(indexOfLastItem, getFilteredAuctions.length)} {t('of')} {getFilteredAuctions.length} {t('auctions')}</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <button onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1} className={`p-4 rounded-2xl border-2 transition-all ${currentPage === 1 ? 'border-slate-50 text-slate-200' : 'border-slate-100 text-[#0A1128] hover:border-[#FEBA4F]'}`}><ChevronLeft size={20}/></button>
                        <div className="flex items-center gap-2">
                            {paginationNumbers.map((p, idx) => typeof p === 'string' ? <span key={idx} className="px-3 text-slate-400 font-bold">...</span> : <button key={idx} onClick={() => handlePageChange(p as number)} className={`w-12 h-12 rounded-2xl font-black text-sm transition-all shadow-sm ${currentPage === p ? 'bg-[#0A1128] text-white scale-110' : 'bg-white border-2 border-slate-50 text-slate-400 hover:border-slate-200'}`}>{p}</button>)}
                        </div>
                        <button onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === totalPages} className={`p-4 rounded-2xl border-2 transition-all ${currentPage === totalPages ? 'border-slate-50 text-slate-200' : 'border-slate-100 text-[#0A1128] hover:border-[#FEBA4F]'}`}><ChevronRight size={20}/></button>
                    </div>
                </div>
            )}
          </div>
        </div>
      );
  }

  const isBannerActive = isLoggedIn && !isVerified;

  return (
    <div className={`min-h-screen bg-[#f3f4f6] font-sans selection:bg-[#FEBA4F] selection:text-[#0A1128] overflow-x-hidden ${isBannerActive ? 'pt-12' : ''}`}>
        <VerificationBanner isVisible={isBannerActive} onAction={() => { window.scrollTo({ top: 0, behavior: 'smooth' }); setActiveView('verification'); }} t={t} />
        <Header 
            onHome={() => { setActiveView('grid'); setSelectedRegion(null); setSelectedCategory(null); setSearchQuery(''); }} 
            onSearch={setSearchQuery} 
            onRegionSelect={(reg) => { setSelectedRegion(reg); setActiveView('grid'); }}
            onCategorySelect={(cat) => { setSelectedCategory(cat); setActiveView('grid'); }} 
            onLastChance={() => { setActiveView('lastChance'); setSelectedRegion(null); setSelectedCategory(null); }} 
            onLogin={() => { window.scrollTo({ top: 0, behavior: 'smooth' }); setActiveView('login'); }} 
            onLogout={handleLogout} 
            onSettings={() => { window.scrollTo({ top: 0, behavior: 'smooth' }); setActiveView('settings'); }} 
            onSubscriptions={() => { window.scrollTo({ top: 0, behavior: 'smooth' }); setActiveView('subscriptions'); }}
            onCreateAuction={() => { window.scrollTo({ top: 0, behavior: 'smooth' }); setActiveView('createAuction'); }} 
            onMyWinnings={() => { window.scrollTo({ top: 0, behavior: 'smooth' }); setActiveView('winnings'); }} 
            onWatchlist={() => { window.scrollTo({ top: 0, behavior: 'smooth' }); setActiveView('watchlist'); }}
            activeView={activeView} 
            selectedRegion={selectedRegion}
            selectedCategory={selectedCategory} 
            isLoggedIn={isLoggedIn} 
            isVerified={isVerified} 
            language={language} 
            onLanguageChange={setLanguage} 
            t={t} 
            auctions={auctions}
        />
        <main>{content}</main>
        {activeView === 'grid' && <Footer t={t} onLegal={setActiveLegal} />}
        {activeLegal && <LegalModal type={activeLegal} onClose={() => setActiveLegal(null)} t={t} />}
        {isCheckoutOpen && checkoutData && (
            <CheckoutModal 
                isOpen={isCheckoutOpen}
                t={t} 
                amount={checkoutData.amount} 
                title={checkoutData.title} 
                onClose={() => setIsCheckoutOpen(false)} 
                onSuccess={checkoutData.onSuccess} 
            />
        )}
        {showBackToTop && (
            <button 
                onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} 
                className="fixed bottom-12 right-12 bg-[#FEBA4F] text-[#0A1128] p-4 rounded-full shadow-2xl hover:scale-110 transition-transform z-50 border-2 border-[#0A1128]"
            >
                <ArrowUp size={24} strokeWidth={3} />
            </button>
        )}
    </div>
  );
};

// --- ADDITIONAL COMPONENTS ---

const VerificationView: React.FC<{ onBack: () => void; t: any; onVerify: (type: 'individual' | 'business', data: any) => void; isVerified: boolean; userType: any }> = ({ onBack, t, onVerify, isVerified, userType }) => {
    const [type, setType] = useState<'individual' | 'business'>(userType || 'individual');
    const [step, setStep] = useState(isVerified ? 2 : 1);
    const [formData, setFormData] = useState<any>({});

    const handleVerify = () => {
        onVerify(type, formData);
        setStep(2);
    };

    return (
        <div className="max-w-4xl mx-auto py-16 px-6 animate-in">
            <button onClick={onBack} className="flex items-center gap-2 text-slate-400 mb-10 font-black uppercase text-[10px] tracking-widest hover:text-[#0A1128] transition-colors"><ArrowLeft size={16}/> Nazaj</button>
            <div className="bg-white rounded-[4rem] p-12 shadow-2xl border border-slate-100">
                <h2 className="text-4xl font-black mb-4 uppercase tracking-tighter italic">{t('identityVerification')}</h2>
                <p className="text-slate-400 font-bold mb-12">V skladu z 18. členom SP je za sodelovanje na dražbi obvezna verifikacija podatkov.</p>

                {step === 1 ? (
                    <div className="space-y-12">
                        <div className="flex gap-4 p-2 bg-slate-50 rounded-[2.5rem]">
                            <button 
                                disabled={isVerified}
                                onClick={() => setType('individual')} 
                                className={`flex-1 flex items-center justify-center gap-3 py-6 rounded-[2rem] font-black uppercase text-xs tracking-widest transition-all ${type === 'individual' ? 'bg-[#0A1128] text-white shadow-xl' : 'text-slate-400 hover:text-[#0A1128]'}`}>
                                <User size={18} /> {t('individual')}
                            </button>
                            <button 
                                disabled={isVerified}
                                onClick={() => setType('business')} 
                                className={`flex-1 flex items-center justify-center gap-3 py-6 rounded-[2rem] font-black uppercase text-xs tracking-widest transition-all ${type === 'business' ? 'bg-[#0A1128] text-white shadow-xl' : 'text-slate-400 hover:text-[#0A1128]'}`}>
                                <Building2 size={18} /> {t('business')}
                            </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {type === 'individual' ? (
                                <>
                                    <div className="space-y-3"><label className="text-[10px] font-black uppercase text-slate-400 ml-2">Ime</label><input type="text" className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 px-6 font-bold" /></div>
                                    <div className="space-y-3"><label className="text-[10px] font-black uppercase text-slate-400 ml-2">Priimek</label><input type="text" className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 px-6 font-bold" /></div>
                                    <div className="space-y-3 md:col-span-2"><label className="text-[10px] font-black uppercase text-slate-400 ml-2">Naslov prebivališča</label><input type="text" className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 px-6 font-bold" /></div>
                                    <div className="space-y-3"><label className="text-[10px] font-black uppercase text-slate-400 ml-2">EMŠO</label><input type="text" className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 px-6 font-bold" maxLength={13} /></div>
                                </>
                            ) : (
                                <>
                                    <div className="space-y-3 md:col-span-2"><label className="text-[10px] font-black uppercase text-slate-400 ml-2">Naziv podjetja</label><input type="text" className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 px-6 font-bold" /></div>
                                    <div className="space-y-3"><label className="text-[10px] font-black uppercase text-slate-400 ml-2">Davčna številka</label><input type="text" className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-4 px-6 font-bold" /></div>
                                    <div className="space-y-3"><label className="text-[10px] font-black uppercase text-slate-400 ml-2">Sedež podjetja</label><input type="text" className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-4 px-6 font-bold" /></div>
                                    <div className="space-y-3 md:col-span-2"><label className="text-[10px] font-black uppercase text-slate-400 ml-2">Zastopnik (Ime in priimek)</label><input type="text" className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 px-6 font-bold" /></div>
                                </>
                            )}
                        </div>

                        <button onClick={handleVerify} className="w-full bg-[#0A1128] text-white py-6 rounded-[2rem] font-black uppercase tracking-widest hover:bg-[#FEBA4F] hover:text-[#0A1128] transition-all shadow-xl">Potrdi verifikacijo</button>
                    </div>
                ) : (
                    <div className="text-center py-12 space-y-8">
                        <div className="w-24 h-24 bg-green-50 text-green-500 rounded-full flex items-center justify-center mx-auto shadow-sm border border-green-100"><CheckCircle2 size={48} /></div>
                        <div>
                            <h3 className="text-2xl font-black text-[#0A1128] uppercase italic mb-2">{t('verifiedStatus')}</h3>
                            <p className="text-slate-400 font-bold">Vaš profil je verificiran kot <span className="text-[#0A1128]">{type === 'individual' ? t('individual') : t('business')}</span>. Sprememba tipa računa po verifikaciji ni več mogoča.</p>
                        </div>
                        <div className="pt-8 border-t border-slate-100 grid grid-cols-2 gap-4">
                            <div className="bg-slate-50 p-6 rounded-3xl text-left"><p className="text-[9px] font-black text-slate-400 uppercase mb-1">Datum verifikacije</p><p className="font-bold">{new Date().toLocaleDateString('sl-SI')}</p></div>
                            <div className="bg-slate-50 p-6 rounded-3xl text-left"><p className="text-[9px] font-black text-slate-400 uppercase mb-1">Status</p><p className="font-bold text-green-600">Aktivno</p></div>
                        </div>
                        <button onClick={onBack} className="w-full bg-[#0A1128] text-white py-6 rounded-[2rem] font-black uppercase tracking-widest hover:bg-[#FEBA4F] transition-all">Nazaj na dražbe</button>
                    </div>
                )}
            </div>
        </div>
    );
};

const DetailView: React.FC<{ 
    item: AuctionItem; 
    t: any; 
    language: string; 
    isVerified: boolean; 
    isWatched: boolean;
    onWatchToggle: () => void;
    currentPlan: SubscriptionTier; 
    onBack: () => void; 
    onBidSubmit: (item: AuctionItem, amount: number) => void; 
    onCheckout: (item: AuctionItem) => void;
    onSellerClick: (seller: Seller) => void;
}> = ({ item, t, language, isVerified, isWatched, onWatchToggle, currentPlan, onBack, onBidSubmit, onCheckout, onSellerClick }) => {
    return (
        <AuctionView 
            item={item} 
            onBack={onBack} 
            onBidSubmit={onBidSubmit} 
            onCheckout={onCheckout} 
            t={t} 
            language={language} 
            isVerified={isVerified} 
            isWatched={isWatched}
            onWatchToggle={onWatchToggle}
            currentPlan={currentPlan} 
            onSellerClick={onSellerClick}
        />
    );
};

const CreateAuctionForm: React.FC<{ onBack: () => void; t: any; onPublish: (item: any) => void }> = ({ onBack, t, onPublish }) => {
    const defaultEndDate = new Date();
    defaultEndDate.setDate(defaultEndDate.getDate() + 7);
    const defaultDateStr = defaultEndDate.toISOString().split('T')[0];
    const defaultTimeStr = "20:00";

    const [formData, setFormData] = useState({ 
        title: '', 
        category: Category.Ostalo, 
        region: Region.Osrednjeslovenska, 
        description: '', 
        startingPrice: '100', 
        minStep: '5',
        endDate: defaultDateStr,
        endTime: defaultTimeStr
    });
    const [imageFiles, setImageFiles] = useState<File[]>([]);
    const [previews, setPreviews] = useState<string[]>([]);
    const [isDragging, setIsDragging] = useState(false);
    const [uploading, setUploading] = useState(false);

    const handleFiles = (files: File[]) => {
        setImageFiles(prev => [...prev, ...files]);
        const newPreviews = files.map(f => URL.createObjectURL(f));
        setPreviews(prev => [...prev, ...newPreviews]);
    };

    const handlePublish = async () => {
        if (!formData.title || !formData.description) return alert(t('enterAllData'));
        
        // Validation for end time
        const selectedEnd = new Date(`${formData.endDate}T${formData.endTime}`);
        const now = new Date();
        const minDate = new Date();
        minDate.setDate(now.getDate() + 3);
        const maxDate = new Date();
        maxDate.setDate(now.getDate() + 14);

        const hour = selectedEnd.getHours();
        const isValidTime = hour >= 6 && hour < 22; // 6:00 to 21:59

        if (selectedEnd < minDate || selectedEnd > maxDate || !isValidTime) {
            return alert(t('invalidEndTime'));
        }

        setUploading(true);
        try {
            const imageUrls = [];
            for (const file of imageFiles) {
                const filePath = `auction-images/${Date.now()}-${file.name}`;
                const { error } = await supabase.storage.from('auction-images').upload(filePath, file);
                if (error) throw error;
                const { data } = supabase.storage.from('auction-images').getPublicUrl(filePath);
                imageUrls.push(data.publicUrl);
            }
            onPublish({ 
                title: { SLO: formData.title },
                startingPrice: formData.startingPrice,
                description: formData.description,
                category: formData.category,
                region: formData.region,
                endTime: selectedEnd.toISOString(),
                images: imageUrls.length > 0 ? imageUrls : ['https://images.unsplash.com/photo-1586191552066-d52dd1e3af86'] 
            });
        } catch (error) { console.error(error); alert(t('publishError')); } finally { setUploading(false); }
    };

    return (
        <div className="max-w-4xl mx-auto px-6 py-14 animate-in">
            <button onClick={onBack} className="flex items-center gap-2 text-slate-400 hover:text-[#0A1128] transition-colors mb-10 font-black text-[10px] uppercase tracking-widest"><ArrowLeft size={16} /> {t('cancel')}</button>
            <div className="bg-white rounded-[3rem] p-10 lg:p-16 shadow-2xl border border-slate-100">
                <h2 className="text-4xl font-black text-[#0A1128] mb-8 uppercase tracking-tighter">{t('newAuction')}</h2>
                <div className="space-y-8">
                    <div className="space-y-4">
                        <label className="text-[10px] font-black uppercase text-slate-400 ml-2">{t('auctionTitle')}</label>
                        <input type="text" placeholder={t('enterTitle')} className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-5 px-6 font-bold focus:ring-4 focus:ring-[#FEBA4F]/20 focus:border-[#FEBA4F] transition-all outline-none" onChange={e => setFormData({...formData, title: e.target.value})} />
                    </div>
                    <div className="space-y-4">
                        <label className="text-[10px] font-black uppercase text-slate-400 ml-2">{t('itemDescription')}</label>
                        <textarea placeholder={t('describeItem')} className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-5 px-6 font-bold h-40 focus:ring-4 focus:ring-[#FEBA4F]/20 focus:border-[#FEBA4F] transition-all outline-none resize-none" onChange={e => setFormData({...formData, description: e.target.value})} />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-4">
                            <label className="text-[10px] font-black uppercase text-slate-400 ml-2">{t('startingPriceEur')}</label>
                            <input type="number" placeholder="100" className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-5 px-6 font-bold focus:ring-4 focus:ring-[#FEBA4F]/20 focus:border-[#FEBA4F] transition-all outline-none" onChange={e => setFormData({...formData, startingPrice: e.target.value})} />
                        </div>
                        <div className="space-y-4">
                            <label className="text-[10px] font-black uppercase text-slate-400 ml-2">{t('category')}</label>
                            <select className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-5 px-6 font-bold focus:ring-4 focus:ring-[#FEBA4F]/20 focus:border-[#FEBA4F] transition-all outline-none appearance-none cursor-pointer" onChange={e => setFormData({...formData, category: e.target.value as Category})}>
                                {Object.values(Category).map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>
                    </div>
                    <div className="space-y-4">
                        <label className="text-[10px] font-black uppercase text-slate-400 ml-2">{t('region')}</label>
                        <select className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-5 px-6 font-bold focus:ring-4 focus:ring-[#FEBA4F]/20 focus:border-[#FEBA4F] transition-all outline-none appearance-none cursor-pointer" onChange={e => setFormData({...formData, region: e.target.value as Region})}>
                            {Object.values(Region).map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                    </div>

                    <div className="space-y-4">
                        <label className="text-[10px] font-black uppercase text-slate-400 ml-2">{t('auctionEndTime')}</label>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="space-y-2">
                                <label className="text-[9px] font-black uppercase text-slate-400 ml-2">{t('endDate')}</label>
                                <input 
                                    type="date" 
                                    value={formData.endDate}
                                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-5 px-6 font-bold focus:ring-4 focus:ring-[#FEBA4F]/20 focus:border-[#FEBA4F] transition-all outline-none" 
                                    onChange={e => setFormData({...formData, endDate: e.target.value})} 
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[9px] font-black uppercase text-slate-400 ml-2">{t('endTime')}</label>
                                <input 
                                    type="time" 
                                    value={formData.endTime}
                                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-5 px-6 font-bold focus:ring-4 focus:ring-[#FEBA4F]/20 focus:border-[#FEBA4F] transition-all outline-none" 
                                    onChange={e => setFormData({...formData, endTime: e.target.value})} 
                                />
                            </div>
                        </div>
                    </div>
                    
                    <div className="space-y-4">
                        <label className="text-[10px] font-black uppercase text-slate-400 ml-2">{t('itemImages')}</label>
                        <div 
                            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                            onDragLeave={() => setIsDragging(false)}
                            onDrop={(e) => { e.preventDefault(); setIsDragging(false); if(e.dataTransfer.files) handleFiles(Array.from(e.dataTransfer.files)); }}
                            className={`p-12 border-4 border-dashed rounded-[2.5rem] text-center transition-all cursor-pointer relative group ${isDragging ? 'border-[#FEBA4F] bg-[#FEBA4F]/5 scale-[1.01]' : 'border-slate-100 bg-slate-50 hover:bg-white hover:border-slate-200'}`}
                        >
                            <input type="file" multiple accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer z-10" onChange={e => e.target.files && handleFiles(Array.from(e.target.files))} />
                            <div className="flex flex-col items-center gap-4">
                                <div className={`p-6 rounded-full transition-all duration-300 ${isDragging ? 'bg-[#FEBA4F] text-[#0A1128] scale-110' : 'bg-white text-slate-300 group-hover:text-[#FEBA4F]'}`}>
                                    <FileUp size={48} strokeWidth={1.5} />
                                </div>
                                <div>
                                    <p className="text-lg font-black text-[#0A1128]">{t('dragImages')}</p>
                                    <p className="text-slate-400 font-bold text-sm">{t('supportedFormats')}</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {previews.length > 0 && (
                        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-4 animate-in">
                            {previews.map((src, i) => (
                                <div key={i} className="relative group aspect-square rounded-2xl overflow-hidden border-2 border-slate-100 shadow-sm transition-transform hover:scale-105">
                                    <img src={src} className="w-full h-full object-cover" />
                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                        <button onClick={() => {
                                            setPreviews(prev => prev.filter((_, idx) => idx !== i));
                                            setImageFiles(prev => prev.filter((_, idx) => idx !== i));
                                        }} className="bg-red-500 text-white p-2.5 rounded-xl shadow-xl transform translate-y-2 group-hover:translate-y-0 transition-all duration-300">
                                            <Trash2 size={18} strokeWidth={2.5} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    <button onClick={handlePublish} disabled={uploading} className="w-full bg-[#0A1128] text-white py-8 rounded-[2rem] font-black uppercase tracking-widest text-lg hover:bg-[#FEBA4F] hover:text-[#0A1128] transition-all shadow-2xl flex items-center justify-center gap-3 active:scale-[0.98]">
                        {uploading ? (
                            <>
                                <div className="w-6 h-6 border-4 border-white/20 border-t-white rounded-full animate-spin"></div>
                                {t('processing')}
                            </>
                        ) : (
                            <>
                                <Gavel size={24} />
                                {t('publishAuction')}
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

const AuthView: React.FC<{ t: any; onLoginSuccess: () => void; setIsVerified: (v: boolean) => void; setAppLoggedIn: (val: boolean) => void }> = ({ t, onLoginSuccess, setIsVerified, setAppLoggedIn }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isLogin) {
          const { error } = await supabase.auth.signInWithPassword({ email, password });
          if (error) throw error;
      } else {
          const { data, error } = await supabase.auth.signUp({ email, password });
          if (error) throw error;
          if (data.user) {
              await supabase.from('users').insert({ id: data.user.id, email, is_verified: false, unpaid_strikes: 0, subscription: 'FREE' });
          }
      }
      onLoginSuccess();
    } catch (error: any) { alert(error.message); } finally { setLoading(false); }
  };

  const demoLogin = (verified: boolean) => {
    setAppLoggedIn(true);
    setIsVerified(verified);
    onLoginSuccess();
  };

  return (
    <div className="max-w-[1600px] mx-auto px-6 py-20 animate-in flex justify-center">
      <div className="bg-white w-full max-w-xl rounded-[4rem] p-10 lg:p-16 shadow-2xl border border-slate-100">
        <div className="text-center mb-10">
            <div className="bg-[#FEBA4F] w-20 h-20 rounded-[2rem] flex items-center justify-center mx-auto mb-6 shadow-lg"><User size={40} className="text-[#0A1128]" /></div>
            <h2 className="text-4xl font-black text-[#0A1128] uppercase tracking-tighter mb-4">{isLogin ? t('login') : t('register')}</h2>
        </div>
        <form onSubmit={handleSubmit} className="space-y-6 mb-8">
          <input type="email" required className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-4 px-6 font-bold focus:ring-2 focus:ring-[#FEBA4F] outline-none" placeholder={t('email')} onChange={e => setEmail(e.target.value)} />
          <input type="password" required className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-4 px-6 font-bold focus:ring-2 focus:ring-[#FEBA4F] outline-none" placeholder={t('password')} onChange={e => setPassword(e.target.value)} />
          <button type="submit" disabled={loading} className="w-full bg-[#0A1128] text-white py-6 rounded-[2rem] font-black uppercase tracking-widest hover:bg-[#FEBA4F] transition-all shadow-xl">{loading ? t('processing') : (isLogin ? t('login') : t('createAccount'))}</button>
          <button type="button" onClick={() => setIsLogin(!isLogin)} className="w-full text-xs font-black uppercase tracking-widest text-slate-400 hover:text-[#0A1128] mt-4">{isLogin ? t('noAccountRegister') : t('haveAccountLogin')}</button>
        </form>

        <div className="pt-8 border-t border-slate-100 space-y-4">
            <button onClick={() => demoLogin(true)} className="w-full border-2 border-green-500 text-green-600 py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-green-50 transition-all flex items-center justify-center gap-2">
                <CheckCircle2 size={14} /> Demo: Verificiran uporabnik
            </button>
            <button onClick={() => demoLogin(false)} className="w-full border-2 border-amber-500 text-amber-600 py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-amber-50 transition-all flex items-center justify-center gap-2">
                <AlertCircle size={14} /> Demo: Neverificiran uporabnik
            </button>
        </div>
      </div>
    </div>
  );
};

export default App;