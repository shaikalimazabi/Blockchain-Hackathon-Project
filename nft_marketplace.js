const DiamnetSdk = require('diamnet-sdk');
const ipfsClient = require('ipfs-http-client');

const diamnet = new DiamnetSdk.Server('https://diamnet.diamcircle.io');
const ipfs = ipfsClient('https://uploadipfs.diamcircle.io');

const nftMarketplace = {
  // Function to mint a new NFT
  mintNFT: async (name, description, image, sourceAccount) => {
    const nft = {
      name,
      description,
      image,
    };

    // Upload the NFT metadata to IPFS
    const ipfsHash = await ipfs.add(JSON.stringify(nft));

    // Create a new NFT on the Diamnet network
    const transaction = await diamnet.transactions.createTransaction({
      sourceAccount,
      operations: [
        {
          type: 'createNFT',
          nft: {
            name,
            description,
            image: `ipfs://${ipfsHash}`,
          },
        },
      ],
    });

    return transaction;
  },

  // Function to list an NFT for sale
  listNFT: async (nftId, price, sourceAccount) => {
    const transaction = await diamnet.transactions.createTransaction({
      sourceAccount,
      operations: [
        {
          type: 'listNFT',
          nftId,
          price,
        },
      ],
    });

    return transaction;
  },

  // Function to buy an NFT
  buyNFT: async (nftId, sourceAccount) => {
    const transaction = await diamnet.transactions.createTransaction({
      sourceAccount,
      operations: [
        {
          type: 'buyNFT',
          nftId,
        },
      ],
    });

    return transaction;
  },

  // Function to sell an NFT
  sellNFT: async (nftId, price, sourceAccount) => {
    const transaction = await diamnet.transactions.createTransaction({
      sourceAccount,
      operations: [
        {
          type: 'sellNFT',
          nftId,
          price,
        },
      ],
    });

    return transaction;
  },
};

module.exports = nftMarketplace;