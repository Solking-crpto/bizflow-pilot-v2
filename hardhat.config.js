require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

const defaultKey = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
const privateKey = process.env.TREASURY_PRIVATE_KEY || defaultKey;
const cleanKey = privateKey.startsWith("0x") ? privateKey : `0x${privateKey}`;

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      evmVersion: "paris", // Crucial: avoid PUSH0 opcode on Arc
    },
  },
  networks: {
    arcTestnet: {
      url: process.env.ARC_TESTNET_RPC_URL || "https://rpc.testnet.arc.io",
      chainId: 5042002,
      accounts: [cleanKey],
    },
    arcMainnet: {
      url: process.env.ARC_MAINNET_RPC_URL || "https://rpc.mainnet.arc.io",
      chainId: 5042,
      accounts: [cleanKey],
    },
  },
};
