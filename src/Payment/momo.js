import crypto from "crypto";

export const generatePaymentRequest = (
  redirectUrl,
  ipnUrl,
  amountValue = 199000
) => {
  const partnerCode = "MOMO";
  const accessKey = "F8BBA842ECF85";
  const secretkey = "K951B6PE1waDMi640xX08PD3vg6EkVlz";
  const requestId = partnerCode + new Date().getTime();
  const orderId = requestId;
  const orderInfo = "Mua Code Premium MyShop";

  const amount = amountValue.toString();
  const requestType = "captureWallet";
  const extraData = "";

  const rawSignature =
    "accessKey=" +
    accessKey +
    "&amount=" +
    amount +
    "&extraData=" +
    extraData +
    "&ipnUrl=" +
    ipnUrl +
    "&orderId=" +
    orderId +
    "&orderInfo=" +
    orderInfo +
    "&partnerCode=" +
    partnerCode +
    "&redirectUrl=" +
    redirectUrl +
    "&requestId=" +
    requestId +
    "&requestType=" +
    requestType;

  console.log("--------------------RAW SIGNATURE----------------");
  console.log(rawSignature);

  const signature = crypto
    .createHmac("sha256", secretkey)
    .update(rawSignature)
    .digest("hex");
  console.log("--------------------SIGNATURE----------------");
  console.log(signature);

  const requestBody = {
    partnerCode: partnerCode,
    accessKey: accessKey,
    requestId: requestId,
    amount: amount,
    orderId: orderId,
    orderInfo: orderInfo,
    redirectUrl,
    ipnUrl,
    extraData: extraData,
    requestType: requestType,
    signature: signature,
    lang: "vi",
  };

  return requestBody;
};
