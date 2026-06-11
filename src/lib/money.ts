export const gbp = (value: number | null | undefined) =>
  new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(Number(value || 0));

export const roundMoney = (value: number) => Math.round(value * 100) / 100;

export const saleNetProfit = ({
  soldPriceEach,
  quantity,
  costEach,
  platformFee,
  postageCost,
  packagingCost,
  otherCost,
}: {
  soldPriceEach: number;
  quantity: number;
  costEach?: number | null;
  platformFee?: number;
  postageCost?: number;
  packagingCost?: number;
  otherCost?: number;
}) => {
  const revenue = soldPriceEach * quantity;
  const itemCost = (costEach || 0) * quantity;
  return roundMoney(
    revenue -
      itemCost -
      (platformFee || 0) -
      (postageCost || 0) -
      (packagingCost || 0) -
      (otherCost || 0),
  );
};
