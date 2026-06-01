declare module "localtunnel" {
  interface Tunnel {
    url: string;
    close(): void;
  }

  interface CreateOptions {
    port: number;
    local_host?: string;
    subdomain?: string;
    host?: string;
  }

  function localtunnel(opts: CreateOptions): Promise<Tunnel>;

  namespace localtunnel {}

  export = localtunnel;
  export default localtunnel;
}
