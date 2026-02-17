import {
  createPublicClient,
  createWalletClient,
  custom,
  parseEther,
  formatEther,
  http
} from "https://esm.sh/viem";

import { sepolia } from "https://esm.sh/viem/chains";
import { abi } from "./abi.js";

console.log("app loaded");

const contractAddress = "0x772857301abC99E453918f2A6112C8D6d3615702";

let account = null;

// PUBLIC CLIENT (RPC)
const publicClient = createPublicClient({
  chain: sepolia,
  transport: http("https://ethereum-sepolia-rpc.publicnode.com")
});

// WALLET CLIENT (MetaMask)
const walletClient = createWalletClient({
  chain: sepolia,
  transport: custom(window.ethereum)
});

// CONNECT WALLET
document.getElementById("connectBtn").onclick = async () => {
  const accounts = await walletClient.requestAddresses();
  account = accounts[0];

  document.getElementById("account").innerText =
    "Connected: " + account;

  await loadPlatformInfo();
  await loadOrders();
};

// CREATE ORDER
document.getElementById("createBtn").onclick = async () => {
  const description = document.getElementById("description").value;
  const amount = document.getElementById("amount").value;

  await walletClient.writeContract({
    address: contractAddress,
    abi,
    functionName: "createOrder",
    args: [description, parseEther(amount)],
    account
  });

  alert("Order created!");
  await loadOrders();
};

// WITHDRAW FEES
document.getElementById("withdrawBtn").onclick = async () => {
  await walletClient.writeContract({
    address: contractAddress,
    abi,
    functionName: "withdrawFees",
    account
  });

  alert("Fees withdrawn!");
  await loadPlatformInfo();
};

// LOAD PLATFORM INFO
async function loadPlatformInfo() {
  const fee = await publicClient.readContract({
    address: contractAddress,
    abi,
    functionName: "platformFee"
  });

  const acc = await publicClient.readContract({
    address: contractAddress,
    abi,
    functionName: "accumulatedFees"
  });

  const owner = await publicClient.readContract({
    address: contractAddress,
    abi,
    functionName: "owner"
  });

  document.getElementById("platformFee").innerText =
    fee.toString();

  document.getElementById("accFees").innerText =
    formatEther(acc);

  if (
    account &&
    account.toLowerCase() === owner.toLowerCase()
  ) {
    document.getElementById("withdrawBtn").style.display =
      "inline-block";
  } else {
    document.getElementById("withdrawBtn").style.display =
      "none";
  }
}

// LOAD ORDERS
async function loadOrders() {
  const counter = await publicClient.readContract({
    address: contractAddress,
    abi,
    functionName: "orderCounter"
  });

  const container = document.getElementById("orders");
  container.innerHTML = "";

  for (let i = 1n; i <= counter; i++) {
    const order = await publicClient.readContract({
      address: contractAddress,
      abi,
      functionName: "orders",
      args: [i]
    });

    const client = order[0];
    const freelancer = order[1];
    const description = order[2];
    const amount = order[3];
    const status = order[4]; // enum = number

    const isClient =
      account &&
      account.toLowerCase() === client.toLowerCase();

    const isFreelancer =
      account &&
      account.toLowerCase() === freelancer.toLowerCase();

    let statusText = "";

    switch (status) {
      case 0:
        statusText = "Open";
        break;
      case 1:
        statusText = "Accepted";
        break;
      case 2:
        statusText = "Funded";
        break;
      case 3:
        statusText = "Completed";
        break;
      case 4:
        statusText = "Cancelled";
        break;
    }

    const card = document.createElement("div");
    card.className = "card";

    card.innerHTML = `
      <p><strong>Order #${i}</strong></p>
      <p>Client: ${client}</p>
      <p>Freelancer: ${freelancer}</p>
      <p>Description: ${description}</p>
      <p>Amount: ${formatEther(amount)} ETH</p>
      <p>Status: ${statusText}</p>
    `;

    // ACCEPT (Open => Accepted)
    if (status === 0 && account && !isClient) {
      const btn = document.createElement("button");
      btn.innerText = "Accept";
      btn.onclick = async () => {
        await walletClient.writeContract({
          address: contractAddress,
          abi,
          functionName: "acceptOrder",
          args: [i],
          account
        });
        await loadOrders();
      };
      card.appendChild(btn);
    }

    // FUND (Accepted => Funded)
    if (status === 1 && isClient) {
      const btn = document.createElement("button");
      btn.innerText = "Fund";
      btn.onclick = async () => {
        await walletClient.writeContract({
          address: contractAddress,
          abi,
          functionName: "fundOrder",
          args: [i],
          value: amount,
          account
        });
        await loadOrders();
      };
      card.appendChild(btn);
    }

    // CONFIRM (Funded => Completed)
    if (status === 2 && isClient) {
      const btn = document.createElement("button");
      btn.innerText = "Confirm Completion";
      btn.onclick = async () => {
        await walletClient.writeContract({
          address: contractAddress,
          abi,
          functionName: "confirmCompletion",
          args: [i],
          account
        });
        await loadOrders();
        await loadPlatformInfo();
      };
      card.appendChild(btn);
    }

    // CANCEL
    if (
      account &&
      (
        (status === 0 && isClient) ||      // Client cancels Open
        (status === 1 && isFreelancer) ||  // Freelancer cancels Accepted
        (status === 2 && isClient)         // Client cancels Funded
      )
    ) {
      const btn = document.createElement("button");
      btn.innerText = "Cancel";
      btn.onclick = async () => {
        await walletClient.writeContract({
          address: contractAddress,
          abi,
          functionName: "cancelOrder",
          args: [i],
          account
        });
        await loadOrders();
        await loadPlatformInfo();
      };
      card.appendChild(btn);
    }

    container.appendChild(card);
  }
}

// Initial load (без кошелька можно смотреть)
loadOrders();
loadPlatformInfo();
