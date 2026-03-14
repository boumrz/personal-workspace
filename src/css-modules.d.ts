declare module "*.module.css" {
  const classes: { readonly [key: string]: string };
  export = classes;
}

declare module "*.css" {
  const content: string;
  export default content;
}
