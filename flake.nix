{
  description = "Keyboard-centric PostgreSQL table viewer for the terminal";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixpkgs-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = {
    nixpkgs,
    flake-utils,
    ...
  }: let
    overlay = final: prev: {
      tablezz = final.rustPlatform.buildRustPackage {
        pname = "tablezz";
        version = (builtins.fromTOML (builtins.readFile ./Cargo.toml)).package.version;

        # Only what the build reads, so target/ and the docs do not force a rebuild
        src = final.lib.fileset.toSource {
          root = ./.;
          fileset = final.lib.fileset.unions [
            ./Cargo.toml
            ./Cargo.lock
            ./src
          ];
        };

        cargoLock.lockFile = ./Cargo.lock;

        meta = {
          description = "Keyboard-centric PostgreSQL table viewer for the terminal";
          homepage = "https://github.com/redsuperbat/tablezz";
          mainProgram = "tablezz";
          platforms = final.lib.platforms.unix;
        };
      };
    };
  in
    flake-utils.lib.eachDefaultSystem (system: let
      pkgs = import nixpkgs {
        inherit system;
        overlays = [overlay];
      };
    in {
      packages = {
        inherit (pkgs) tablezz;
        default = pkgs.tablezz;
      };

      apps.default = flake-utils.lib.mkApp {drv = pkgs.tablezz;};

      devShells.default = pkgs.mkShell {
        inputsFrom = [pkgs.tablezz];
        packages = with pkgs; [
          rust-analyzer
          rustfmt
          clippy
          pgcli
        ];
      };
    })
    // {
      overlays.default = overlay;
    };
}
