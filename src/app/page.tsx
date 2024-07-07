"use client";

import { useEffect, useState } from "react";
import { API_BASE, NETWORK_PREFIX } from "./config";
import { bech32m } from "bech32";

interface Window {
  ethereum: any;
}

export default function Home() {
  const [gobyInstalled, setGobyInstalled] = useState<boolean | null>(null);
  const [address, setAddress] = useState<string>('');

  useEffect(() => {
    if(gobyInstalled === null) {
      const chia = (window as any).chia;
      const gobyInstalled_ = chia && chia.isGoby;

      setGobyInstalled(gobyInstalled_); 
      return;
    }

    if (!gobyInstalled) {
      console.log('Goby is not installed :(');
      return;
    }

    (window as any).chia.on("accountChanged", () => {
      window.location.reload()
    });

    (window as any).chia.request({ method: 'connect', params: { eager: true } }).then((connected: boolean) => {
      if(!connected) {
        return;
      }
      
      const puzzle_hash = (window as any).chia.selectedAddress
      const address = bech32m.encode(NETWORK_PREFIX,
        bech32m.toWords(Buffer.from(puzzle_hash, 'hex'))
      )
      console.log({ address })
      setAddress(address);
    });
  }, [gobyInstalled, setGobyInstalled, address, setAddress]);

  const connectGoby = () => (window as any).chia.request({ method: 'connect', params: { eager: false } }).then((connected: boolean) => {
    if(!connected) {
      return;
    }

    const puzzle_hash = (window as any).chia.selectedAddress
    const address = bech32m.encode(NETWORK_PREFIX,
      bech32m.toWords(Buffer.from(puzzle_hash, 'hex'))
    )
    console.log({ address })
    setAddress(address);
  });

  if(gobyInstalled === null) {
    return <></>;
  }

  return (
    <main className="flex min-h-screen flex-col items-center p-8">
      <h1 className="text-xl font-medium mb-8">DataLayer Test App</h1>

      {!gobyInstalled ?
        <p>please use a browser with Goby installed</p> :
        (!address ? <button onClick={connectGoby} className="bg-gray-400 px-4 py-2 rounded-lg">Connect Goby</button> : <p className="pb-8">Goby Address: {address}</p>)
      }

      {address && <MainComponent address={address}/>}
    </main>
  );
}

function MainComponent({ address }: { address: string }) {
  const [serverInfo, setServerInfo] = useState<any>(null);
  const loading = serverInfo === null;

  useEffect(() => {
    const p = async () => {
      const res = await fetch(`${API_BASE}/info`)

      setServerInfo(await res.json());
    }

    if(!serverInfo) {
      p();
    }
  }, [serverInfo, setServerInfo]);

  if(loading) {
    return (
      <>Loading data...</>
    );
  }

  return (
    <div>
      <div className="container mx-auto p-4">
        <div className="bg-white shadow-md rounded p-6">
          <h2 className="text-2xl font-bold mb-4">Server Info</h2>
          <pre className="bg-gray-100 p-4 rounded overflow-auto">
            <code className="text-sm text-gray-800">
              { JSON.stringify(serverInfo, null, 2) }
            </code>
          </pre>
        </div>
      </div>
    </div>
  );
}
