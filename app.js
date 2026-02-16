import {
  createPublicClient,
  createWalletClient,
  custom,
  parseEther,
  formatEther
} from "https://esm.sh/viem";

import { sepolia } from "https://esm.sh/viem/chains";
import { abi } from "./abi.js";

console.log("app loaded");

const contractAddress = "0x772857301abC99E453918f2A6112C8D6d3615702";

let account;

const publicClient = createPublicClient({
  chain: sepolia,
  transport: custom(window.ethereum)
});

const walletClient = createWalletClient({
  chain: sepolia,
  transport: custom(window.ethereum)
});

document.getElementById("connectBtn").onclick = async () => {
  const accounts = await walletClient.requestAddresses();
  account = accounts[0];
  document.getElementById("account").innerText = "Connected: " + account;

  await loadPlatformInfo();
  await loadOrders();
};

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

  document.getElementById("platformFee").innerText = fee.toString();
  document.getElementById("accFees").innerText = formatEther(acc);

  if (account && account.toLowerCase() === owner.toLowerCase()) {
    document.getElementById("withdrawBtn").style.display = "inline-block";
  }
}

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

    let statusText = "";
    let statusClass = "";

    if (order.status === 0n) {
      statusText = "Open";
      statusClass = "status-open";
    }
    if (order.status === 1n) {
      statusText = "Accepted";
      statusClass = "status-accepted";
    }
    if (order.status === 2n) {
      statusText = "Funded";
      statusClass = "status-funded";
    }
    if (order.status === 3n) {
      statusText = "Completed";
      statusClass = "status-completed";
    }

    const card = document.createElement("div");
    card.className = "card";

    card.innerHTML = `
      <p><strong>Order #${i}</strong></p>
      <p>Client: ${order.client}</p>
      <p>Freelancer: ${order.freelancer}</p>
      <p>Description: ${order.description}</p>
      <p>Amount: ${formatEther(order.amount)} ETH</p>
      <p>Status: <span class="${statusClass}">${statusText}</span></p>
    `;

    // ACCEPT
    if (order.status === 0n && account !== order.client) {
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

    // FUND
    if (order.status === 1n && account === order.client) {
      const btn = document.createElement("button");
      btn.innerText = "Fund";
      btn.onclick = async () => {
        await walletClient.writeContract({
          address: contractAddress,
          abi,
          functionName: "fundOrder",
          args: [i],
          value: order.amount,
          account
        });
        await loadOrders();
      };
      card.appendChild(btn);
    }

    // CONFIRM COMPLETION
    if (order.status === 2n && account === order.client) {
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

    container.appendChild(card);
  }
}
