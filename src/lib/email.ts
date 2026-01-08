import { Resend } from 'resend';

export interface DealAlert {
  title: string;
  price: number | null;
  url: string;
  dealScore: number;
  reasoning: string;
  imageUrl: string | null;
  identifiedProduct: string | null;
  retailPriceRange: { low: number; high: number } | null;
  condition: string;
  marketComparison: string;
}

export interface AlertEmailParams {
  recipientEmail: string;
  recipientName?: string;
  searchQuery: string;
  zipcode: string;
  deals: DealAlert[];
}

function formatPrice(cents: number | null): string {
  if (cents === null) return 'Price not listed';
  return `$${(cents / 100).toLocaleString()}`;
}

function generateEmailHTML(params: AlertEmailParams): string {
  const { searchQuery, zipcode, deals } = params;

  const dealCards = deals.map(deal => `
        <div style="border: 1px solid #e0e0e0; border-radius: 12px; padding: 20px; margin-bottom: 16px; background: #fff;">
            <div style="display: flex; gap: 16px;">
                ${deal.imageUrl ? `<img src="${deal.imageUrl}" alt="" style="width: 120px; height: 90px; object-fit: cover; border-radius: 8px;">` : ''}
                <div style="flex: 1;">
                    <h3 style="margin: 0 0 8px 0; font-size: 16px;">
                        <a href="${deal.url}" style="color: #1a1a1a; text-decoration: none;">${deal.title}</a>
                    </h3>
                    <div style="font-size: 24px; font-weight: 700; color: #00d4aa; margin-bottom: 8px;">
                        ${formatPrice(deal.price)}
                    </div>
                    <div style="display: inline-block; background: ${deal.dealScore >= 80 ? '#dcfce7' : '#fef9c3'}; color: ${deal.dealScore >= 80 ? '#166534' : '#854d0e'}; padding: 4px 12px; border-radius: 100px; font-size: 13px; font-weight: 600;">
                        Score: ${deal.dealScore}/100
                    </div>
                </div>
            </div>
            <p style="margin: 12px 0 0 0; font-size: 14px; color: #666; line-height: 1.5;">
                ${deal.reasoning}
            </p>
            ${deal.retailPriceRange ? `
                <p style="margin: 8px 0 0 0; font-size: 13px; color: #888;">
                    Retail: ${formatPrice(deal.retailPriceRange.low)} - ${formatPrice(deal.retailPriceRange.high)}
                </p>
            ` : ''}
            <a href="${deal.url}" style="display: inline-block; margin-top: 12px; background: #00d4aa; color: #000; padding: 10px 20px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px;">
                View on Craigslist →
            </a>
        </div>
    `).join('');

  return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; margin: 0; padding: 20px;">
    <div style="max-width: 600px; margin: 0 auto; background: #fff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
        <div style="background: #0a0a0a; color: #fff; padding: 24px; text-align: center;">
            <h1 style="margin: 0; font-size: 24px;">🎯 New Deals Found!</h1>
            <p style="margin: 8px 0 0 0; color: #888; font-size: 14px;">
                ${deals.length} great deal${deals.length > 1 ? 's' : ''} for "${searchQuery}" near ${zipcode}
            </p>
        </div>
        <div style="padding: 24px;">
            ${dealCards}
        </div>
        <div style="background: #f9f9f9; padding: 16px 24px; text-align: center; border-top: 1px solid #e0e0e0;">
            <p style="margin: 0; font-size: 12px; color: #888;">
                Prices are AI-estimated. Always verify before purchasing.
            </p>
        </div>
    </div>
</body>
</html>`;
}

export async function sendDealAlertEmail(params: AlertEmailParams): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    console.log('RESEND_API_KEY not set - skipping email');
    console.log(`Would have sent ${params.deals.length} deals to ${params.recipientEmail}`);
    return false;
  }

  const resend = new Resend(apiKey);

  try {
    const { error } = await resend.emails.send({
      from: 'DealFinder <deals@yourdomain.com>', // Update with your verified domain
      to: params.recipientEmail,
      subject: `🎯 ${params.deals.length} new deal${params.deals.length > 1 ? 's' : ''} for "${params.searchQuery}"`,
      html: generateEmailHTML(params),
    });

    if (error) {
      console.error('Resend error:', error);
      return false;
    }

    console.log(`Email sent to ${params.recipientEmail}`);
    return true;
  } catch (error) {
    console.error('Error sending email:', error);
    return false;
  }
}
