import {
  Keypair,
  TransactionBuilder,
  Operation,
  BASE_FEE,
  Aurora,
  Asset,
} from "diamnet-sdk";
import axios from "axios";
import fs from "fs";
import path from "path";
import https from "https";
import sharp from "sharp"; // A library to handle image processing
import { create } from "ipfs-http-client";

// Initialize IPFS client
const ipfsClient = create({
  url: "https://uploadipfs.diamcircle.io",
});

const currentDir = process.cwd();

// Function to create an asset and activate the account on TESTNET
async function createTestnetAsset(assetName, userSecret, s3ImageUrl) {
  try {
    // Validate input
    if (!assetName || !userSecret || !s3ImageUrl) {
      throw new Error("Missing required fields");
    }

    // Define constants for TESTNET
    const auroraServerUrl = "https://diamtestnet.diamcircle.io/";
    const networkPassphrase = "Diamante Testnet 2024";
    const masterSecret =
      "SB3SSDG2VNLGMX4OZLSL6FI4XO6NTA2QM3AXPLDLCMDIEWWTTAZW2MHY"; //
    const startingBalance = "5";

    // Diamante server setup
    const server = new Aurora.Server(auroraServerUrl);

    // Master account (for activation purposes)
    const masterKeypair = Keypair.fromSecret(masterSecret);
    console.log("Master Keypair:", masterKeypair.publicKey());

    const userKeypair = Keypair.fromSecret(userSecret);
    console.log("User Keypair:", userKeypair.publicKey());

    // Create a new keypair for the asset issuer
    const issuerKeypair = Keypair.random();
    const issuerPublicKey = issuerKeypair.publicKey();

    const asset = new Asset(assetName, issuerPublicKey);

    // Activate the new keypair using the master account
    const masterAccount = await server.loadAccount(masterKeypair.publicKey());
    const agent = new https.Agent({
      rejectUnauthorized: false,
    });

    // Check master account balance
    const masterBalances = masterAccount.balances;
    const masterBalance = masterBalances.find(
      (balance) => balance.asset_type === "native"
    ).balance;

    // Check if the balance is sufficient
    if (parseFloat(masterBalance) <= 1) {
      throw new Error("Master account balance is insufficient.");
    }

    // Download the image from S3
    const imagePath = path.join(currentDir, "temp-image.png");
    const response = await axios({
      url: s3ImageUrl,
      method: "GET",
      responseType: "arraybuffer",
      httpsAgent: agent,
    });

    // Convert the image buffer to PNG and save locally
    await sharp(response.data).png().toFile(imagePath);

    // Upload image to IPFS
    const imageBuffer = fs.readFileSync(imagePath);
    const ipfsResult = await ipfsClient.add(imageBuffer);
    const imageCID = ipfsResult.path;
    console.log("Image CID:", imageCID);

    // Remove the local image file after upload
    fs.unlinkSync(imagePath);

    // Create the account
    const createAccountTransaction = new TransactionBuilder(masterAccount, {
      fee: BASE_FEE,
      networkPassphrase: networkPassphrase,
    })
      .addOperation(
        Operation.createAccount({
          destination: issuerPublicKey,
          startingBalance: startingBalance,
        })
      )

      .addOperation(
        Operation.changeTrust({
          asset: asset,
          source: userKeypair.publicKey(),
        })
      )
      .addOperation(
        Operation.manageData({
          name: assetName,
          source: issuerPublicKey,
          value: imageCID.toString(),
        })
      )
      .addOperation(
        Operation.payment({
          destination: userKeypair.publicKey(),
          source: issuerPublicKey,
          asset: asset,
          amount: "0.0000001",
        })
      )
      .addOperation(
        Operation.setOptions({
          source: issuerPublicKey,
          masterWeight: 0,
        })
      )
      .setTimeout(10000)
      .build();

    // Sign the transaction
    createAccountTransaction.sign(masterKeypair, issuerKeypair, userKeypair);

    await server.submitTransaction(createAccountTransaction);
    // Get the XDR of the transaction
    //const xdr1 = createAccountTransaction.toXDR();

    // Return the XDR and asset name
    return { issuerPublicKey, assetName };
  } catch (error) {
    console.error("Error:", error);
    throw error;
  }
}

// Example usage:
createTestnetAsset(
  "TestAsset",
  "SCCCPVUVMHUD42QNKXMFPWQ2HUYJJS3E76XEY622DHMTRBAOUHLDLRIE",
  "https://ipfs.io/ipfs/QmQAVJQG8gaTUWHpRV91CFscsayt3gHzzGWzn6jq4NPcE1?filename=nft.png"
)
  .then((result) => console.log("Asset created:", result))
  .catch((error) => console.error("Error creating asset:", error));

  