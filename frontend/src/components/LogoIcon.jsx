const LogoIcon = ({ size = 24, className = "", ...props }) => (
  <img
    src="/writeai-favicon-192.png"
    alt="WriteAI"
    style={{
      width: size,
      height: size,
      objectFit: "contain",
    }}
    className={className}
    {...props}
  />
);

export default LogoIcon;