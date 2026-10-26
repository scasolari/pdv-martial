import Avatar, { genConfig } from "react-nice-avatar";

const config = genConfig("placedv-local-user");

function LocalAvatar({ size = 24 }) {
    return <Avatar style={{ width: size, height: size }} {...config} />;
}

export default LocalAvatar;
