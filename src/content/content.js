console.log("EXTENSION ACTIVE");

const root = document.createElement("div");
root.style.position = "fixed";
root.style.top = "20px";
root.style.right = "20px";
root.style.zIndex = "999999";
root.style.background = "black";
root.style.color = "white";
root.style.padding = "10px";

root.innerText = "REDDIT EXTENSION WORKS";

document.body.appendChild(root);