// web-ext.d.ts
declare module "web-ext" {
  export namespace cmd {
    type BuildOptions = {
      sourceDir?: string;
      artifactsDir?: string;
      filename?: string;
      overwriteDest?: boolean;
      ignoreFiles?: string[];
      verbose?: boolean;
      lint?: boolean;
    };

    type GlobalOptions = {
      shouldExitProgram?: boolean;
    };

    function build(
      options?: BuildOptions,
      globalOptions?: GlobalOptions,
    ): Promise<string>;
  }
}
