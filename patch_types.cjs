const fs = require('fs');
let code = fs.readFileSync('types.ts', 'utf8');

if (code.includes('export type ViewState =')) {
    code = code.replace(/export type ViewState =.*?;/, "export type ViewState = 'grid' | 'detail' | 'login' | 'sellerProfile' | 'createAuction' | 'settings' | 'verification' | 'winnings' | 'lastChance' | 'subscriptions' | 'watchlist' | 'myBids' | 'mySold' | 'messages' | 'myUnsold';");
}

const auctionItemReplacement = `
    location: { SLO: string; EN: string; DE: string } | string;
    description: { SLO: string; EN: string; DE: string } | string;
    post_auction_status?: string;
    top_bids?: any[];
    second_highest_bidder_id?: string;
    delivery_option?: string;
    selected_delivery?: string;
    shipping_fee_type?: string;
    shipping_cost?: number;
    shipping_receipt_url?: string;
    is_delivery_locked?: boolean;
`;

if (code.includes('location: { SLO: string; EN: string; DE: string } | string;')) {
    code = code.replace('location: { SLO: string; EN: string; DE: string } | string;\n    description: { SLO: string; EN: string; DE: string } | string;', auctionItemReplacement);
}

fs.writeFileSync('types.ts', code);
console.log("Types patched");
